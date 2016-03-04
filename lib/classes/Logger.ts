import * as fs from "fs";

export class Logger {
    private name : string;
    private useFile : boolean;
    constructor(name : string, useFile : boolean = false) {
        this.name = name;
        this.useFile = useFile;
        if (useFile && !fs.existsSync("./logs")) {
            fs.mkdirSync("./logs");
        }
    }
    private log(msg : string) : void {
        console.log(msg);
        if (this.useFile) {
            fs.appendFileSync("./logs/" + this.name + ".log", msg + "\n");
        }
    }
    public error(msg : string) : void {
        this.log("[ERROR] " + msg + "\n" + (new Error()).stack);
    }
    public warn(msg : string) : void {
        this.log("[WARN] " + msg);
    }
    public info(msg : string) : void {
        this.log("[INFO] " + msg);
    }
    public debug(msg : string) : void {
        this.log("[DEBUG] " + msg);
    }
    public trace(msg : string) : void {
        this.log("[TRACE] " + msg);
    }
}
