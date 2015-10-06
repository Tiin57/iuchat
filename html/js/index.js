var socket;
var channel = "#general";
var sentUsername = false;
var username = "";
var password = "";
var serverURL = "wss://testing.csclub.cs.iupui.edu:4236/";
var isLoggedIn = false;

function getParameterByName(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
	var results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function escapeHTML(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function getLocation() {
	return encodeURIComponent(window.location.href);
}

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
	document.getElementById("output").innerHTML += str + "<br />";
	scrollBottom();
}

function onInputSubmit() {
	data = $("#input").val();
	if (data == "") {
		return;
	}
	$("#input").val("");
	socket.emit("chatmsg", {
		message: data,
		channel: channel
	});
}

function setupForm() {
	socket = io(serverURL);
	socket.on("chatmsg", function(data) {
		processMessage(data);
	});
	socket.on("login", function(data) {
		if (!data.isLoggedIn) {
			location.search = "";
			addText("Login failed. Please try again!");
		} else {
			isLoggedIn = true;
		}
	});
	socket.on("connect", function() {
		addText("Connected to the server (" + serverURL + ")");
		if (serverURL.startsWith("wss://")) {
			addText("Your connection to the server is encrypted via SSL.");
		}
	});
	socket.on("disconnect", function() {
		addText("Disconnected from the server (" + serverURL + ")");
	});
	$("#input").focus();
	document.getElementById("input").placeholder = "";
	document.getElementById("submit").onclick = onInputSubmit;
	document.getElementById("input").onkeydown = function(evt) {
		if (evt.keyCode == 13) {
			onInputSubmit();
		}
	};
}

function processMessage(data) {
	if (!data || !data.time || !data.username || !data.message || !data.channel) {
		return false;
	}
	addText(escapeHTML("[" + data.time + "] " + data.username + ": " + data.message));
}

$(function() {
	fixClientSizes();
	$(window).resize(fixClientSizes);
	var casticket = getParameterByName("casticket");
	if (casticket != "") {
		setupForm();
		socket.emit("login", {
			"token": casticket,
			"url": window.location.protocol + "//" + window.location.host + window.location.pathname
		});
	} else {
		addText("<a href='https://cas.iu.edu/cas/login/?cassvc=IU&casurl=" + getLocation() + "'>Please log in</a>");
	}
});