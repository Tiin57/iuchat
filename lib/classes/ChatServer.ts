module.id = "ChatServer";
import * as env from "../autoload";

import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as socketIO from "socket.io";

var commandDir : string = "../commands/";

export class ChatServer {
    private server : (http.Server | https.Server);
    private io : SocketIO.Server;
    private commands : env.Command[];
    private users : env.User[];
    public constructor() {
        this.commands = [];
        this.users = [];
        this.configure();
        this.loadCommands();
    }
    private configure() : void {
        if (env.config.server.useSSL) {
            this.server = https.createServer({
                ca: fs.readFileSync(env.config.server.ssl.ca),
                cert: fs.readFileSync(env.config.server.ssl.cert),
                key: fs.readFileSync(env.config.server.ssl.key)
            });
        } else {
            this.server = http.createServer();
        }
        this.io = socketIO(this.server);
        this.io.on("connection", this.onConnect);
    }
    public onConnect(socket : SocketIO.Socket) : void {
        this.users.push(new env.User(socket));
    }
    public loadCommands() {
        fs.readdir(commandDir, function(err : Error, files : string[]) {
            for (var i in files) {
                if (files[i].endsWith(".js")) {
                    this.commands.push(require(commandDir + files[i]));
                }
            }
        });
    }
    public start() : void {
        this.server.listen(env.config.server.port, function() {
            env.logger.info("Server running on port "
                + env.config.server.port + "...");
        });
    }
}
