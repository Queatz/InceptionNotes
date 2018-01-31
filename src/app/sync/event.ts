import { SyncService } from "app/sync.service";

export class Event {
    types: Map<any, string> = new Map();
    actions: Map<string, any> = new Map();

    constructor() {
        this.types.set(SyncEvent, 'sync');
        this.types.set(IdentifyEvent, 'identify');
        this.types.set(BasicMessageEvent, 'message');
        
        this.types.forEach((v, k) => this.actions.set(v, k));
    }
}

// Client events

export class SyncEvent {
    notes: any[];

    constructor(notes: any[]) {
        this.notes = notes;
    }
}

export class IdentifyEvent {
    me: string;
    client: string;

    constructor(me: string, client: string) {
        this.me = me;
        this.client = client;
    }
}

// Server events

export interface ServerEvent {
    got(sync: SyncService): void;
}

export class BasicMessageEvent implements ServerEvent {
    message: string;

    public got(sync: SyncService) {
        window.alert(this.message);
    }
}
