import * as env from "../autoload";

import * as socketIO from "socket.io";

interface DataLogin {
    url : string;
    token : string;
}

interface DataMessage {

}

export default class User {
    public socket : SocketIO.Socket;
    public username : string;
    public isLoggedIn : boolean;
    public constructor(socket : SocketIO.Socket) {
        this.socket = socket;
    }
    private init() : void {
        var user : User = this;
        this.socket.on(env.protocol.login, function(data : DataLogin) {
            if (!data.url || !data.token) {
                env.logger.warn("Invalid data " + data.toString());
                return;
            }
            user.verify(data);
        });
    }
    public verify(data : DataLogin) {
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
    public send(from : string, msg : string) {
        this.socket.emit(env.protocol.message, {

        });
    }
    public sendSystem(msg : string) {

    }
}
