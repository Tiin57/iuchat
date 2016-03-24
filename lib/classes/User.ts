import * as env from "../autoload";

import * as socketIO from "socket.io";

export default class User {
    public socket : SocketIO.Socket;
    public username : string;
    public isLoggedIn : boolean;
    public constructor(socket : SocketIO.Socket) {
        this.socket = socket;
    }
    private init() : void {
        var user : User = this;
        this.socket.on(env.protocol.login, function(data : env.DataLogin) {
            if (!env.protocol.checkLogin(data)) {
                env.logger.warn("Invalid data " + JSON.stringify(data));
                return;
            }
            user.verify(data);
        });
        this.socket.on(env.protocol.message, function(data : env.DataMessage) {
            if (!env.protocol.checkMessage(data)) {
                env.logger.warn("Invalid data " + JSON.stringify(data));
                return;
            }
            if (!user.isLoggedIn) {
                user.sendSystem("You are not logged in.");
                return;
            }
            var now : Date = new Date();
            if (data.message.startsWith("/")) { // commands

            } else { // non-commands
                var msg : env.ServerMessage = {
                    "message": data.message,
                    "from": user.username,
                    "date": env.clock.getDate(new Date()),
                    "time": env.clock.getTime(now),
                    "channel": data.channel
                };
                user.socket.broadcast.emit(env.protocol.message, msg);
                user.send(msg);
            }
        });
        this.socket.on("disconnect", function() {

        });
    }
    public verify(data : env.DataLogin) {
        var user : User = this;
        var getParams = {
            "cassvc": "IU",
            "casticket": data.token,
            "casurl": data.url
        };
        env.http.request("cas.iu.edu/cas/validate", "GET", getParams, true, function(code : number, data : string) {
            if (code != 200) {
                env.logger.warn("HTTP error on CAS validate (" + code + ")");
                user.onVerify(null);
            }
            var lines = data.split("\n");
            if (lines[0].trim() == "yes") {
                user.onVerify(lines[1].trim());
            } else {
                user.onVerify(null);
            }
        });
    }
    public onVerify(username : string) : void {
        if (username == null) {
            this.sendSystem("Authentication failed!");
            this.socket.emit(env.protocol.login, {"isLoggedIn": false});
            return;
        }
        this.sendSystem("Authentication succeeded!");
        this.username = username;
        this.isLoggedIn = true;
        this.socket.emit(env.protocol.login, {"isLoggedIn": true});
    }
    public send(msg : env.ServerMessage) {
        this.socket.emit(env.protocol.message, msg);
    }
    public sendSystem(msg : string) {

    }
}
