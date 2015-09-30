var ActiveDirectory = require("activedirectory");
var cfg = require("./config.json");
var bunyan = require("bunyan");
var io = require("socket.io")(cfg.port);
var fs = require("fs");
var banned = require("./banned.json");

var log = bunyan.createLogger({
	"name": "IU Chat",
	"streams": [{
		"level": "trace",
		"stream": fs.createWriteStream("iuchat-adtrace.log")
	}]
});
var clients = [];
var adConfig = {
	url: "ldap" + (cfg.ldap.ssl ? "s" : "") + "://" + cfg.ldap.server + ":" + cfg.ldap.port,
	baseDN: "dc=ads,dc=iu,dc=edu",
	username: cfg.ldap.username,
	password: cfg.ldap.password,
	scope: "one",
	"log": log
};

function info(data) {
	console.log("[INFO] " + data.toString());
}

function error(data) {
	console.log("[ERROR] " + data.toString());
}

function invalid(data) {
	info("Received invalid data " + data.toString());
}

function getToday() {
	var date = new Date();
	return (date.getMonth() + 1).toString() + "/" + date.getDate().toString() + "/" + date.getFullYear().toString();
}

function getTime() {
	var date = new Date();
	return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

function createCallback(func, a) {
	return function(b, c, d, e, f) {
		func(a, b, c, d, e, f);
	};
}

function sendSystemMessage(socket, message) {
	sendChatMessage(socket, "SYSTEM", message);
}

function sendChatMessage(socket, username, message) {
	var data = {
		"username": username,
		"message": message,
		"date": getToday(),
		"time": getTime(),
		"channel": "#general"
	};
	socket.emit("chatmsg", data);
}

function verifyLDAP(username, password, callback) {
	username = "ADS\\" + username;
	var ad = new ActiveDirectory(adConfig);
	ad.authenticate(username, password, function(err, auth) {
		if (err) {
			error("verifyLDAP failed.");
			error(JSON.stringify(err));
			callback(false, username, null);
			return;
		}
		callback(!!auth, username, ad);
	});
}

function setupUserData(ad, client, callback) {
	var username = client.username;
	var ad = new ActiveDirectory(adConfig);
	ad.findUser(username, function(err, user) {
		if (err) {
			error("setupUserData failed.");
			error(JSON.stringify(err));
			callback(false);
			return;
		}
		console.log(user);
		client.firstName = user.givenName;
		callback(true);
	});
}

function Client(socket) {
	this.username = "";
	this.isLoggedIn = false;
	this.firstName = "";
	this.socket = socket;
	socket.on("login", createCallback(function(client, data) {
		if (!data || !data.username || !data.password) {
			invalid(data);
			return;
		}
		for (var i in banned) {
			if (i == data.username) {
				sendSystemMessage(client.socket, "You are banned from IU Chat.");
				return;
			}
		}
		verifyLDAP(data.username, data.password, createCallback(function(client, auth, username, ad) {
			username = username.split("\\")[1];
			if (auth) {
				var msg = "Authentication as " + username + " succeeded!";
				try {
					info(msg);
					sendSystemMessage(socket, msg);
					client.username = username;
					setupUserData(ad, client, function(isCorrect) {
						if (isCorrect) {
							client.isLoggedIn = true;
							client.socket.emit("login", {"isLoggedIn": true});
						}
					});
				} catch (ex) {
					error("Exception " + ex.toString());
					client.socket.emit("login", {"isLoggedIn": false});
				}
			} else {
				var msg = "Authentication as " + username + " failed!";
				info(msg);
				sendSystemMessage(socket, msg);
				client.socket.emit("login", {"isLoggedIn": false});
			}
		}, client));
	}, this));
	socket.on("chatmsg", createCallback(function(client, data) {
		if (!data.message || !data.channel) {
			invalid(data);
			return;
		}
		if (!client.isLoggedIn) {
			sendSystemMessage(socket, "You are not logged in. Please refresh your page.");
			return;
		}
		sendChatMessage(client.socket.broadcast, client.username, data.message);
		sendChatMessage(client.socket, client.firstName, data.message);
	}, this));
}

io.on("connection", function(socket) {
	clients.push(new Client(socket));
	console.log("Client connected.");
});