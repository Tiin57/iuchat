/*
*** SECURITY NOTICE ***
Understandably, there may be concerns about password security in an application
that authenticates against an LDAP server. Please rest assured that any and all
passwords that this program utilizes (aside from the LDAP credentials in config.json)
are not stored or saved in any way except in-memory, temporarily, to authenticate users.
Any method that accesses user passwords (not including config.json passwords, as those
cannot be entered by users) are labeled with "*** PASSWORD ACCESS ***" for convenience.
If you don't believe my statement, that's fine. Look through those methods yourself.
If you don't believe that I labeled every password-accessing method, that's fine. I
very well could have missed one. Look through all of the source code and submit a pull
request adding the missing notice as necessary. There's a reason this is open-source,
people.

Author: Alexander David Hicks (Tiin57, aldahick)
Date created: 29 September, 2015
*/
var ActiveDirectory = require("activedirectory");
var cfg = require("./config.json");
var bunyan = require("bunyan");
var io = require("socket.io")(cfg.port);
var fs = require("fs");
var banned = {};
fs.access("./banned.json", fs.F_OK | fs.R_OK | fs.W_OK, function(err) {
	if (!err) {
		banned = require("./banned.json");
	} else {
		fs.writeFileSync("./banned.json", "{}");
	}
});
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

var commands = {
	"ban": {
		adminOnly: true,
		callback: function(client, args) {
			if (args.length === 0) {
				sendSystemMessage(client.socket, "Usage: /ban <username>");
				return;
			}
			banUser(client.username, args[0]);
			sendSystemMessage(client.socket, "Banned " + client.username);
		}
	}
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

function getNow() {
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
		"time": getNow(),
		"channel": "#general"
	};
	socket.emit("chatmsg", data);
}

function updateBans() {
	fs.writeSync("./banned.json", JSON.stringify(banned));
}

function banUser(author, username) {
	if (!banned[username]) {
		banned[username] = {
			time: getNow(),
			date: getToday(),
			author: author,
			current: true,
			pastBans: []
		};
	} else {
		banned[username].time = getNow();
		banned[username].date = getToday();
		banned[username].author = author;
		banned[username].current = true;
	}
	for (var i in clients) {
		if (clients[i].username == username) {
			clients[i].socket.disconnect();
			clients.splice(i, 1);
		}
	}
	updateBans();
}

function unbanUser(username) {
	if (!banned[username]) {
		return;
	}
	var ban = banned[username];
	ban.pastBans = undefined;
	ban.current = false;
	banned[username].current = false;
	banned[username].pastBans.push(ban);
	updateBans();
}

/*
*** PASSWORD ACCESS ***
Checks <username> and <password> against Active Directory as a user.
*/
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
		client.firstName = user.givenName;
		if (cfg.admins[client.username]) {
			client.isAdmin = true;
		}
		callback(true);
	});
}

/*
*** PASSWORD ACCESS *** - Specifically, the socket.on("login") callback.
*/
function Client(socket) {
	this.username = "";
	this.isLoggedIn = false;
	this.firstName = "";
	this.socket = socket;
	this.isAdmin = false;
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
		if (data.message.startsWith("/")) {
			var msg = data.message.substring(1);
			var tokens = msg.split(" ");
			var cmd = tokens.splice(0, 1).toLowerCase();
			if (commands[cmd]) {
				if (commands[cmd].adminOnly && !client.isAdmin) {
					sendSystemMessage(client.socket, "You must be a chat administrator to run that command.");
				} else {
					(commands[cmd].callback)(client, tokens);
				}
			} else {
				sendSystemMessage(client.socket, "Command " + cmd + " is not valid.");
			}
		} else {
			sendChatMessage(client.socket.broadcast, client.username, data.message);
			sendChatMessage(client.socket, client.firstName, data.message);
		}
	}, this));
}

io.on("connection", function(socket) {
	clients.push(new Client(socket));
	console.log("Client connected.");
});