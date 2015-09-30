var socket;
var channel = "#general";
var sentUsername = false;
var username = "";

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
	} else {
		var password = data;
		socket.emit("login", {
			username: username,
			password: password
		});
		document.getElementById("input").type = "text";
	}
}

function setupPostLogin() {
	document.getElementById("submit").onclick = onInputSubmit;
	document.getElementById("input").onkeydown = function(evt) {
		if (evt.keyCode == 13) {
			onInputSubmit();
		}
	};
}

function setupPreLogin() {
	addText("Please enter your username and password in the input field below.");
	document.getElementById("submit").onclick = onLoginSubmit;
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
	socket = io("http://localhost:4236");
	socket.on("chatmsg", function(data) {
		processMessage(data);
	});
	socket.on("login", function(data) {
		if (!data.isLoggedIn) {
			sentUsername = false;
		} else {
			setupPostLogin();
		}
	});
	setupPreLogin();
;});