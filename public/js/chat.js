var Chat = function(url) {
    this.url = url;
    this.socket = null;
    this.handlers = {};
    this.isConnected = false;
    this.connect = function() {
        this.socket = io(url);
        this.socket.on("connect", function() {
            this.isConnected = true;
            this.fireEvent("connect", []);
        });
    };
    this.fireEvent = function(eventName, args) {
        if (!this.handlers[eventName]) {
            return;
        }
        for (var i in this.handlers[eventName]) {
            (this.handlers[eventName][i]).apply(this, args);
        }
    };
    this.on = function(eventName, callback) {
        if (!this.handlers[eventName]) {
            this.handlers[eventName] = [];
        }
        this.handlers[eventName].push(callback);
    };
    
};
