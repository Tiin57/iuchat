import * as querystring from "querystring";
import * as http from "http";
import * as https from "https";

export default class HelperHttp {
    public static request(url : string, method : string = "GET", args : {[key: string] : any} = {}, useSSL : boolean = false, callback : (code : number, response : string) => void = function(code : number, response : string) {}, encodeParams : boolean = true) {
        var argsString : string = "";
        if (encodeParams) {
            argsString = querystring.stringify(args);
        } else {
            for (var i in args) {
                argsString += "&" + i + "=" + args[i];
            }
            argsString = argsString.replace("&", "?"); // This only replaces the first occurrence
        }
        var tokens : string[] = url.split("/");
        var host : string = tokens.splice(0, 1)[0];
        var path : string = "/" + tokens.join("/");
        var headers : {[key : string] : (string | number)} = {};
        if (method.toLowerCase() == "post") {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            headers["Content-Length"] = argsString.length;
        }
        var options = {
            "hostname": host,
            "port": 443,
            "path": path + (method.toLowerCase() == "post" ? "" : argsString),
            "method": method,
            "headers": headers
        };
        var request = (useSSL ? https : http).request(options, function(res : any) {
            var response : string = "";
            res.setEncoding("utf8");
            res.on("data", function(chunk : string) {
                response += chunk;
            });
            res.on("end", function() {
                callback(res.statusCode, response);
            });
        });
        if (method.toLowerCase() == "post") {
            request.write(argsString);
        }
        request.end();
    }
}
