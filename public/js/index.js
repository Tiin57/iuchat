var chat;

$(document).ready(function() {
    function addMessage(time, username, message) {
        var $row = $("<tr>");
        $row.append($("<td>").html(time));
        $row.append($("<td>").html(username));
        $row.append($("<td>").html(message));
        $("#message-container").append($row);
    }
    function fixSize() {
        $("#message-window").height($(window).height() * 0.8);
    }
    function scrollToBottom() {
        var $window = $("#message-window");
        $window.scrollTop($window[0].scrollHeight - $window.height());
    }
    chat = new Chat();
    chat.on("message", addMessage);
    $("#form-chat").submit(function() {
        chat.sendMessage($("#input-chat-message").val());
        $("#input-chat-message").val("");
        return false; // don't go away!
    });
    fixSize();
    $(window).on("resize", function() {
        fixSize();
        scrollToBottom();
    })
});
