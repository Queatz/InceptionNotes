
export class Event {
    types: Map<any, string> = new Map();

    constructor() {
        this.types.set(SyncEvent, 'sync');
    }
}

export class SyncEvent {
    me: string;
    since: string;
    events: any[];

    constructor(me: string, since: string = undefined, events: any[] = undefined) {
        this.me = me;
        this.since = since;
        this.events = events;
    }
}