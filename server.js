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
// Load modules
var fs = require("fs");
var ActiveDirectory = require("activedirectory");
var cfg = require("./config.json"); // Load config first, since https setup requires values from it
var bunyan = require("bunyan");
var querystring = require("querystring");
var httpServer = null;
// Create HTTP server for use in Socket.IO
// Socket.IO does not allow us to specify SSL files.
// If we're avoiding SSL, just make an HTTP server
if (cfg["avoidSSL"]) {
	var http = require("http");
	httpServer = http.Server();
} else {
	var https = require("https");
	httpServer = https.Server({
		cert: fs.readFileSync(cfg.https.cert),
		key: fs.readFileSync(cfg.https.key),
		ca: fs.readFileSync(cfg.https.ca)
	});
}
var crypto = require("crypto");
var io = require("socket.io")(httpServer); // Construct Socket.IO server using HTTPS server.

/**
Attempts to load a JSON file and return the data.
If the file does not exist or is not readable, the method
will attempt to create it with initial contents of "{}"
and return {}.
@param file The file to operate on
@return The unserialized JSON data contained in the file
*/
function loadDataJSON(file) {
	try {
		fs.accessSync(file, fs.F_OK | fs.R_OK);
	} catch (ex) {
		fs.writeFileSync(file, "{}");
		return {};
	}
	return require(file);
}
var banned = loadDataJSON("./banned.json");
var nicknames = loadDataJSON("./nicknames.json");
var hashes = loadDataJSON("./hashes.json");
// Create a logger for use in activedirectory module, so we get all data.
var log = bunyan.createLogger({
	"name": "IU Chat",
	"streams": [{
		"level": "error",
		"stream": fs.createWriteStream("iuchat-adtrace.log")
	}]
});
var clients = []; // We need this for WHOIS and KICK.
// Global ActiveDirectory config
var adConfig = {
	url: "ldap" + (cfg.ldap.ssl ? "s" : "") + "://" + cfg.ldap.server + ":" + cfg.ldap.port,
	baseDN: cfg.ldap.baseDN,
	scope: "one",
	"log": log
};
/**
Commands are registered here.
Keys/values:
{
	boolean adminOnly: If the command requires admin
	string help: Message displayed when /help is used.
	function callback: Code for the command to execcute
}
Documentation of each command's purpose can be found in "help"
*/
var commands = {
	"ban": {
		adminOnly: true,
		help: "Bans a user and kicks them if online. Usage: /ban <username>",
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
		help: "Unbans a user. Usage: /unban <username>",
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
		help: "Kicks a user, disconnecting them. Usage: /kick <username>",
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
		help: "Gets all available information of a user. Usage: /whois <username>",
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
		help: "Changes or sets your nickname. Usage: /nick <nickname>",
		callback: function(client, args) {
			if (args.length === 0) {
				sendSystemMessage(client.socket, "Usage: /nick <nickname>");
				return;
			}
			nickUser(client, args[0]);
		}
	},
	"help": {
		adminOnly: false,
		help: "Displays this help message.",
		callback: function(client, args) {
			for (var i in commands) {
				if (commands[i].isAdmin && !client.isAdmin) {
					continue;
				}
				sendSystemMessage(client.socket, "/" + i + ": " + commands[i].help)
			}
		}
	},
	"bot": {
		adminOnly: false,
		help: "Generates or retrieves a unique hash for use in a bot.",
		callback: function(client, args) {
			if (!hashes[client.username]) {
				var hash = client.username + generateBotHash();
				var sha256 = crypto.createHash("sha256");
				sha256.update(hash);
				hashes[client.username] = sha256.digest("hex");
				fs.writeFileSync("./hashes.json", JSON.stringify(hashes));
			}
			sendSystemMessage(client.socket, "Your hash is " + hashes[client.username]);
		}
	}
};

/*
Logs a string as info.
@param 
*/
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

function postHTTPS(url, args, callback) {
	var data = querystring.stringify(args);
	var tokens = url.split("/");
	var host = tokens.splice(0, 1)[0];
	var path = "/" + tokens.join("/");
	var options = {
		hostname: host,
		port: 443,
		"path": path,
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Content-Length": data.length
		}
	};
	var ret = "";
	var req = https.request(options, function(res) {
		res.setEncoding("utf8");
		res.on("data", function(chunk) {
			ret += chunk;
		});
		res.on("end", function() {
			callback(res.statusCode, ret);
		});
	});
	req.write(data);
	req.end();
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
	nickname = nickname.replace(" ", "").replace("\\", "").replace("*", "").replace("(", "").replace(")", "");
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
			clients[i].isLoggedIn = false;
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

function generateBotHash() {
	try {
		return crypto.randomBytes(32).toString("hex");
	} catch (ex) {
		return false;
	}
}

/*
*** PASSWORD ACCESS ***
Builds a modified configuration based on <username> and <password>.
Should only be called by verifyLDAP().
*/
function generateADConfig(username, password) {
	return {
		url: adConfig.url,
		hostname: cfg.ldap.server,
		port: cfg.ldap.port,
		ssl: cfg.ldap.ssl,
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
	if (cfg.proxy.useMe) {
		adcfg.operation = "authenticate";
		adcfg.rawUsername = username;
		postHTTPS(cfg.proxy.url, adcfg, function(code, auth) {
			if (code != 200 || auth.startsWith("err")) {
				error("Failed at verifyLDAP with " + auth);
				callback(false, username, null);
				return;
			}
			callback(auth == "true", username, adcfg);
		});
	} else {
		var ad = new ActiveDirectory(adcfg);
		ad.authenticate(username, password, function(err, auth) {
			if (err) {
				callback(false, username, null);
				return;
			}
			callback(!!auth, username, ad);
		});
	}
}

function setupUserData(ad, client, isBot, callback) {
	var username = client.username;
	if (cfg.proxy.useMe) {
		ad.operation = "getUser";
		ad.rawUsername = username;
		postHTTPS(cfg.proxy.url, ad, function(code, user) {
			if (code != 200) {
				error("Failed at setupUserData");
				callback(false);
				return;
			}
			if (user.startsWith("err")) {
				error("Failed at setupUserData with " + user);
				callback(false);
				return;
			}
			user = JSON.parse(user);
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
	} else {
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
			if (isBot) {
				client.firstName += " (BOT)";
			}
			if (cfg.admins[client.username]) {
				client.isAdmin = true;
			}
			callback(true);
		});
	}
}

function validateUsername(username) {
	return username.replace("*", "").replace("(", "").replace(")", "").replace("\\", "");
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
	sendSystemMessage(this.socket, cfg.motd);
	socket.on("login", createCallback(function(client, data) {
		if (!data || ((!data.username && !data.key) || !data.password)) {
			invalid(data);
			return;
		}
		if (data.key) {
			var isValid = false;
			for (var i in hashes) {
				if (hashes[i] == data.key) {
					data.username = i;
					isValid = true;
					break;
				}
			}
			if (!isValid) {
				sendSystemMessage("Bot authentication with key " + data.key + " failed.");
				client.socket.emit("login", {"isLoggedIn": false});
				return;
			}
		}
		for (var i in banned) {
			if (i == data.username && banned[i].current) {
				sendSystemMessage(client.socket, "You were banned from IU Chat by " + banned[i].author + " on " + banned[i].date + " at " + banned[i].time);
				client.socket.emit("login", {"isLoggedIn": false});
				return;
			}
		}
		var _username = validateUsername(data.username);
		verifyLDAP(_username, data.password, createCallback(function(client, auth, username, ad) {
			username = username.split("\\")[1];
			if (auth) {
				var msg = "Authentication as " + username + " succeeded!";
				try {
					info(msg);
					sendSystemMessage(socket, msg);
					client.username = username;
					if (nicknames[username]) {
							client.firstName = nicknames[username];
							client.hasNickname = true;
					}
					setupUserData(ad, client, !!data.key, function(isCorrect) {
						if (isCorrect) {
							client.isLoggedIn = true;
							client.socket.emit("login", {"isLoggedIn": true});
							sendSystemBroadcast(client.socket, client.firstName + " has connected.");
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