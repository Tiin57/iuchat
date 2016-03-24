export interface DataLogin {
    url : string;
    token : string;
}

export interface DataMessage {
    message : string;
    channel : string;
}

export interface ServerMessage {
    message : string;
    from : string;
    date : string;
    time : string;
    channel : string;
}

export class protocol {
    public static login : string = "login";
    public static message : string = "chatmsg";

    public static checkLogin(data : any) : boolean {
        return data.url && data.token;
    }

    public static checkMessage(data : any) : boolean {
        return data.message && data.channel;
    }

    public static buildLogin(isLoggedIn : boolean) {
        return {
            "isLoggedIn": isLoggedIn
        };
    }
}
