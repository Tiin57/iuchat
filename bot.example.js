var io = require("socket.io-client");
var cfg = require("./config.bot.json");
var socket = io.connect("wss://testing.csclub.cs.iupui.edu:4236");

function sendMessage(msg) {
	socket.emit("chatmsg", {
		channel: "#general",
		message: msg
	});
}
socket.on("connect", function() {
	socket.emit("login", {
		key: cfg.key,
		password: cfg.password
	});
});
socket.on("chatmsg", function(data) {
	if (data.username == "SYSTEM" || !data.message.startsWith("%")) {
		return;
	}
	var tokens = data.message.substring(1).split(" ");
	var cmd = tokens.splice(0, 1);
	if (cmd == "hello") {
		sendMessage("Hello, " + data.username + "!");
	}
});
socket.on("login", function(data) {
	console.log(data);
});
