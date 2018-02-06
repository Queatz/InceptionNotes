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
    this.ws.onBeforeOpen.subscribe(() => this.send(new IdentifyEvent(this.me, this.clientKey())));
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

    this.ws.reconnect();

    let syncAllEvent = new SyncEvent([]);
    let an = this.api.getAllNotes();
    for(let k in an) {
      let n = an[k];

      if (n.transient) {
        continue;
      }

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
      if (!this.ws.active()) {
        return;
      }

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
    this.ws.send([[this.event.types.get(event.constructor), event]]);
  }

  /**
   * Called on got
   */
  public got(events: any[]) {
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
  }

  /**
   * Called on open
   */
  public open() {
  }

  /**
   * Set a note as sync'd
   */
  public setSynced(id: string, prop: string) {
    this.api.setSynced(id, prop);
  }
}
