/// <reference path="../typings/main"/>

var es6 : any = require("es6-shim");
import * as fs from "fs";
import {Logger} from "./classes/Logger";

export var config : any = JSON.parse(fs.readFileSync("./lib/config.json").toString());
export var logger : Logger = new Logger("main", module.parent.id);

export {default as clock} from "./helpers/HelperClock";
export {default as http} from "./helpers/HelperHttp";

export {default as Command} from "./classes/Command";
export * from "./classes/Protocol";
export {default as User} from "./classes/User";
