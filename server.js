/*
*** SECURITY NOTICE ***
Understandably, there may be concerns about password security in an application
that authenticates against an LDAP server. Please rest assured that any and all
passwords that this program utilizes are not stored or saved in any way. Any method
that accesses user passwords are labeled with "*** PASSWORD ACCESS ***" for convenience.
If you don't believe my statement, that's fine. Look through those methods yourself.
If you don't believe that I labeled every password-accessing method, that's fine. I
very well could have missed one. Look through all of the source code and submit a pull
request adding the missing notice as necessary. There's a reason this is open-source,
people. By the way, all communication, from client to server and from server to LDAP
server, is encrypted with SSL. I strongly suggest acquiring signed SSL certificates.

Author: Alexander David Hicks (Tiin57, aldahick)
Date created: 29 September, 2015
*/
var fs = require("fs");
var ActiveDirectory = require("activedirectory");
var cfg = require("./config.json");
var bunyan = require("bunyan");
var https = require("https");
var httpServer = https.Server({
	cert: fs.readFileSync(cfg.https.cert),
	key: fs.readFileSync(cfg.https.key),
	ca: fs.readFileSync(cfg.https.ca)
});
var io = require("socket.io")(httpServer);
var banned = {};
var nicknames = {};
fs.access("./banned.json", fs.F_OK | fs.R_OK | fs.W_OK, function(err) {
	if (!err) {
		banned = require("./banned.json");
	} else {
		fs.writeFileSync("./banned.json", "{}");
	}
});
fs.access("./nicknames.json", fs.F_OK | fs.R_OK | fs.W_OK, function(err) {
	if (!err) {
		nicknames = require("./nicknames.json");
	} else {
		fs.writeFileSync("./nicknames.json", "{}");
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
	baseDN: cfg.ldap.baseDN,
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
			banUser(client.firstName, args[0]);
			sendSystemMessage(client.socket, "Banned " + args[0]);
		}
	},
	"unban": {
		adminOnly: true,
		callback: function(client, args) {
			if (args.length === 0) {
				sendSystemMessage(client.socket, "Usage: /unban <username>");
				return;
			}
			unbanUser(args[0]);
			sendSystemMessage(client.socket, "Unbanned " + args[0]);
		}
	},
	"kick": {
		adminOnly: true,
		callback: function(client, args) {
			if (args.length === 0) {
				sendSystemMessage(client.socket, "Usage: /kick <user> [reason]");
				return;
			}
			var name = args.splice(0, 1)[0];
			var reason = args.length > 0 ? args.join(" ") : "None";
			kickUser(client.firstName, name, reason);
		}
	},
	"whois": {
		adminOnly: false,
		callback: function(client, args) {
			if (args.length === 0) {
				sendSystemMessage(client.socket, "Usage: /whois <user>");
				return;
			}
			whoisUser(client, args[0]);
		}
	},
	"nick": {
		adminOnly: false,
		callback: function(client, args) {
			if (args.length === 0) {
				sendSystemMessage(client.socket, "Usage: /nick <nickname>");
				return;
			}
			nickUser(client, args[0]);
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
	var month = date.getMonth().toString();
	month = (month.length == 1 ? "0" : "") + month;
	var day = date.getDate().toString();
	day = (day.length == 1 ? "0" : "") + day;
	return month + "/" + day + "/" + date.getFullYear().toString();
}

function getNow() {
	var date = new Date();
	var hours = date.getHours().toString();
	hours = (hours.length == 1 ? "0" : "") + hours;
	var minutes = date.getMinutes().toString();
	minutes = (minutes.length == 1 ? "0" : "") + minutes;
	var seconds = date.getSeconds().toString();
	seconds = (seconds.length == 1 ? "0" : "") + seconds;
	return hours + ":" + minutes + ":" + seconds;
}

function createCallback(func, a) {
	return function(b, c, d, e, f) {
		try {
			func(a, b, c, d, e, f);
		} catch (ex) {
			error(ex.toString());
		}
	};
}

function sendSystemMessage(socket, message) {
	var lines = message.split("\n");
	for (var i in lines) {
		sendChatMessage(socket, "SYSTEM", lines[i]);
	}
}

function sendSystemBroadcast(socket, message) {
	sendSystemMessage(socket, message);
	sendSystemMessage(socket.broadcast, message);
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
	fs.writeFileSync("./banned.json", JSON.stringify(banned));
}

function nickUser(client, nickname) {
	for (var i in nicknames) {
		if (nicknames[i] == nickname) {
			sendSystemMessage(client, "Sorry, the nickname " + nickname + " is taken.");
			return;
		}
	}
	nicknames[client.username] = nickname;
	client.firstName = nickname;
	client.hasNickname = true;
	fs.writeFileSync("./nicknames.json", JSON.stringify(nicknames));
	sendSystemBroadcast(client.socket, "User " + client.username + " has changed their nickname to " + nickname + ".");
}

function whoisUser(client, username) {
	for (var i in clients) {
		if (clients[i].firstName == username) {
			sendSystemMessage(client.socket, "WHOIS " + username + "\nUsername: " + clients[i].username);
			break;
		}
	}
}

function kickUser(author, username, reason) {
	for (var i in clients) {
		if (clients[i].username == username) {
			sendSystemMessage(clients[i].socket, "You have been kicked by " + author + " for \"" + reason + "\"");
			sendSystemMessage(clients[i].socket.broadcast, clients[i].firstName + " has been kicked by " + author + ".");
			clients[i].socket.disconnect();
			clients.splice(i, 1);
		}
	}
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
	kickUser(author, username, "Banned.");
	updateBans();
}

function unbanUser(username) {
	if (!banned[username]) {
		return;
	}
	var cban = banned[username];
	var ban = {};
	ban.time = cban.time;
	ban.date = cban.date;
	ban.author = cban.author;
	ban.pastBans = undefined;
	ban.current = false;
	banned[username].current = false;
	banned[username].pastBans.push(ban);
	updateBans();
}

/*
*** PASSWORD ACCESS ***
Builds a modified configuration based on <username> and <password>.
Should only be called by verifyLDAP().
*/
function generateADConfig(username, password) {
	return {
		url: adConfig.url,
		baseDN: adConfig.baseDN,
		scope: adConfig.scope,
		log: adConfig.log,
		"username": username,
		"password": password
	};
}

/*
*** PASSWORD ACCESS ***
Checks <username> and <password> against Active Directory as a user.
*/
function verifyLDAP(username, password, callback) {
	username = "ADS\\" + username;
	var adcfg = generateADConfig(username, password);
	var ad = new ActiveDirectory(adcfg);
	ad.authenticate(username, password, function(err, auth) {
		if (err) {
			callback(false, username, null);
			return;
		}
		callback(!!auth, username, ad);
	});
}

function setupUserData(ad, client, callback) {
	var username = client.username;
	ad.findUser(username, function(err, user) {
		if (err) {
			callback(false);
			return;
		}
		if (client.firstName == "") {
			client.firstName = user.givenName;
			if (client.firstName == undefined || client.firstName == "undefined") {
				client.firstName = client.username;
				client.hasNickname = true;
			}
		}
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
	this.hasNickname = false;
	socket.on("login", createCallback(function(client, data) {
		if (!data || !data.username || !data.password) {
			invalid(data);
			return;
		}
		for (var i in banned) {
			if (i == data.username && banned[i].current) {
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
					if (nicknames[username]) {
						client.firstName = nicknames[username];
					}
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
			var cmd = tokens.splice(0, 1)[0].toLowerCase();
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
			sendChatMessage(client.socket.broadcast, (client.hasNickname ? "~" : "") + client.firstName, data.message);
			sendChatMessage(client.socket, (client.hasNickname ? "~" : "") + client.firstName, data.message);
		}
	}, this));
	socket.on("disconnect", createCallback(function(client, data) {
		if (client.isLoggedIn) {
			sendSystemMessage(io, client.firstName + " has disconnected.");
		}
	}, this));
}

io.on("connection", function(socket) {
	clients.push(new Client(socket));
	console.log("Client connected.");
});

httpServer.listen(cfg.port, function() {
	console.log("Server started on port " + cfg.port);
});