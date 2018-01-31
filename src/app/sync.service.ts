import { Injectable } from '@angular/core';
import { Config } from 'app/config.service';
import { WsService } from 'app/ws.service';
import { Event, SyncEvent, IdentifyEvent, ServerEvent } from 'app/sync/event';
import { ApiService } from 'app/api.service';
import util from 'app/util';

@Injectable()
export class SyncService {

  private me: string;
  private event: Event;
  private _clientKey = null;

  constructor(private ws: WsService, private api: ApiService) {
    this.ws.syncService = this;
    this.event = new Event();
  }

  private clientKey() {
    if (!this._clientKey) {
      this._clientKey = localStorage.getItem('client-key');

      if (!this._clientKey) {
        this._clientKey = util.newKey();
        localStorage.setItem('client-key', this._clientKey);
      }
    }

    return this._clientKey;
  }

  /**
   * Start syncing
   */
  public start(me: string) {
    this.me = me;
    this.send(new IdentifyEvent(me, this.clientKey()));

    let syncAllEvent = new SyncEvent([]);
    for(let k in this.api.getAllNotes()) {
      let n = this.api.getAllNotes()[k];
      if ('_sync' in n) {
        let p: any = {};
        for(let k in n['sync']) {
          if (!n['sync'][k].synchronized) {
            p[k] = n[k];
          }
        }

        if (Object.keys(p).length) {
          p.id = n.id;
          syncAllEvent.notes.push(this.api.freezeNote(p));
        }
      } else {
        syncAllEvent.notes.push(this.api.freezeNote(n));
      }
    }

    if (syncAllEvent.notes.length) {
      this.send(syncAllEvent);
    }

    this.api.onNoteChangedObservable.subscribe(change => {
      this.send(new SyncEvent([this.api.freezeNote({
        id: change.note.id,
        [change.property]: change.note[change.property]
      })]));
    });
  }

  /**
   * Send
   */
  public send(event: any) {
    let events = [[this.event.types.get(event.constructor), event]];
    console.log('(ws) send: ' + JSON.stringify(events));    
    this.ws.send(events);
  }

  /**
   * Called on got
   */
  public got(events: any[]) {
    console.log('(ws) got: ' + JSON.stringify(events));
    events.forEach((event: any[]) => {
      let t = this.event.actions.get(event[0]);
      event[1].__proto__ = t.prototype;
      event[1].got(this);
    });
  }

  /**
   * Called on close
   */
  public close() {
    console.log('(ws) closed');    
  }

  /**
   * Called on open
   */
  public open() {
    console.log('(ws) opened');
  }
}
