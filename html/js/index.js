var socket;
var channel = "#general";
var sentUsername = false;
var username = "";
var password = "";
var serverURL = "YOUR_URL_HERE";

function getWindowWidth() {
	var width;
	if (document.body && document.body.offsetWidth) {
		width = document.body.offsetWidth;
	}
	if (document.compatMode=='CSS1Compat' &&
		document.documentElement &&
		document.documentElement.offsetWidth ) {
		width = document.documentElement.offsetWidth;
	}
	if (window.innerWidth) {
		width = window.innerWidth;
	}
	return width;
}

function getWindowHeight() {
	var height;
	if (document.body && document.body.offsetHeight) {
		height = document.body.offsetHeight;
	}
	if (document.compatMode=='CSS1Compat' &&
		document.documentElement &&
		document.documentElement.offsetHeight ) {
		height = document.documentElement.offsetHeight;
	}
	if (window.innerHeight) {
		height = window.innerHeight;
	}
	return height;
}

function fixClientSizes() {
	var width = getWindowWidth();
	var height = getWindowHeight();
	$("#output").width(width - 20);
	$("#output").height(height - ($("#input").height() * 3));
	$("#input").width(width - ($("#submit").width() * 2));
}

function scrollBottom() {
	var output = document.getElementById("output");
	output.scrollTop = output.scrollHeight;
}

function addText(str) {
	document.getElementById("output").innerHTML += str + "\n";
	scrollBottom();
}

function onInputSubmit() {
	data = $("#input").val();
	$("#input").val("");
	socket.emit("chatmsg", {
		message: data,
		channel: channel
	});
}

function onLoginSubmit() {
	data = $("#input").val();
	$("#input").val("");
	if (!sentUsername) {
		username = data;
		sentUsername = true;
		document.getElementById("input").type = "password";
		document.getElementById("input").placeholder = "IU Password";
	} else {
		password = data;
		socket.emit("login", {
			username: username,
			password: password
		});
		document.getElementById("input").type = "text";
		document.getElementById("input").placeholder = "";
	}
}

function setupPostLogin() {
	document.getElementById("input").placeholder = "";
	document.getElementById("submit").onclick = onInputSubmit;
	document.getElementById("input").onkeydown = function(evt) {
		if (evt.keyCode == 13) {
			onInputSubmit();
		}
	};
}

function setupPreLogin() {
	document.getElementById("submit").onclick = onLoginSubmit;
	document.getElementById("input").placeholder = "IU Username";
	sentUsername = false;
	document.getElementById("input").type = "text";
	document.getElementById("input").onkeydown = function(evt) {
		if (evt.keyCode == 13) {
			onLoginSubmit();
		}
	};
}

function processMessage(data) {
	if (!data || !data.time || !data.username || !data.message || !data.channel) {
		return false;
	}
	addText("[" + data.time + "] " + data.username + ": " + data.message);
}

$(function() {
	fixClientSizes();
	$(window).resize(fixClientSizes);
	socket = io(serverURL);
	socket.on("chatmsg", function(data) {
		processMessage(data);
	});
	socket.on("login", function(data) {
		if (!data.isLoggedIn) {
			sentUsername = false;
			document.getElementById("input").placeholder = "IU Username";
		} else {
			setupPostLogin();
		}
	});
	socket.on("connect", function() {
		addText("Connected to the server (" + serverURL + ")");
		if (serverURL.startsWith("wss://")) {
			addText("Your connection to the server is encrypted via SSL.");
		}
		addText("Please enter your username and password in the input field below.");
		if (username != "" && password != "") {
			socket.emit("login", {
				username: username,
				password, password
			});
			addText("Attempting to reconnect to the server...");
		}
	});
	socket.on("disconnect", function() {
		addText("Disconnected from the server (" + serverURL + ")");
	});
	setupPreLogin();
	$("#input").focus();
;});