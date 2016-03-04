import {default as User} from "./User";

interface Command {
    getCommands() : string[];
    handle(user : User, command : string, args : string[]) : boolean;
}

export default Command;
