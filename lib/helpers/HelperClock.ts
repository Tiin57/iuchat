export default class Clock {
    public static getTime(date : Date) : string {
        return date.toLocaleTimeString();
    }
    public static getDate(date : Date) : string {
        return date.toDateString();
    }
}
