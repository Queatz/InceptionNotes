
export class Event {
    types: Map<any, string> = new Map();

    constructor() {
        this.types.set(SyncEvent, 'sync');
    }
}

export class SyncEvent {
    me: string;
    notes: any[];

    constructor(me: string, notes: any[] = undefined) {
        this.me = me;
        this.notes = notes;
    }
}