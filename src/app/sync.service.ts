import { Injectable } from '@angular/core';
import { Config } from 'app/config.service';
import { WsService } from 'app/ws.service';
import { Event, SyncEvent, IdentifyEvent, ServerEvent, ShowEvent } from 'app/sync/event';
import { ApiService } from 'app/api.service';
import util from 'app/util';
import { UiService } from 'app/ui.service';

@Injectable()
export class SyncService {

  private me: string;
  private event: Event;
  private _clientKey = null;

  constructor(private ws: WsService, private api: ApiService, private ui: UiService, private config: Config) {
    this.ws.syncService = this;

    this.ws.onBeforeOpen.subscribe(() => {
      this.send(new IdentifyEvent(this.clientKey(), this.me));
      
      if (this.api.getShow()) {
        this.send(new ShowEvent(this.api.getShow().id));
      }
    });

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
  public start() {
    this.ws.reconnect();

    let syncAllEvent = new SyncEvent([]);
    let an = this.api.getAllNotes();
    for(let k in an) {
      let n = an[k];

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

      if (change.note[change.property] === undefined) {
        return;
      }

      this.send(new SyncEvent([this.api.freezeNote({
        id: change.note.id,
        [change.property]: change.note[change.property]
      })]));
    });

    this.api.onViewChangedObservable.subscribe(view => {
      this.send(new ShowEvent(view.show.id));
    });
  }

  /**
   * Identify person
   */
  setPerson(me: any) {
    this.me = me;
  }

  /**
   * Send
   */
  public send(event: any) {
    if (this.config.beta) {
      console.log('send', event);
    }
    this.ws.send([[this.event.types.get(event.constructor), event]]);
  }

  /**
   * Called on got
   */
  public got(events: any[]) {
    events.forEach((event: any[]) => {
      if (this.config.beta) {
        console.log('got', event);
      }  
      let t = this.event.actions.get(event[0]);
      event[1].__proto__ = t.prototype;
      event[1].got(this);
    });
  }

  /**
   * Called on close
   */
  public close() {
    if (this.config.beta) {
      console.log('close()');
    }
  }

  /**
   * Called on open
   */
  public open() {
    if (this.config.beta) {
      console.log('open()');
    }
  }

  /**
   * Set a note as sync'd
   */
  public setSynced(id: string, prop: string) {
    this.api.setSynced(id, prop);
  }

  /**
   * Handle note prop update from sever
   */
  public handleUpdateFromServer(noteId: string, prop: string, value: any) {
    let note = this.api.search(noteId);

    if (!note) {
      note = this.api.newBlankNote(noteId);
    }

    let v = this.api.unfreezeProp(note, prop, value);
    if (note.transient || this.api.isSynced(note, prop)) {
      note[prop] = v;
      this.api.setSynced(note.id, prop);
    } else if(this.valEquals(note[prop], v)) {
      this.api.setSynced(note.id, prop);
    } else {
      this.ui.dialog({
        message: 'Overwrite ' + prop + ' "' + this.present(note[prop]) + '" with "' + this.present(v) + '"',
        ok: () => {
          note[prop] = v;
          this.api.setSynced(note.id, prop);
        },
        cancel: () => {
          this.send(new SyncEvent([this.api.freezeNote({
            id: note.id,
            [prop]: note[prop]
          })]));
        }
      });
    }
  }

  /**
   * Return if a value is equal.
   */
  public valEquals(a: any, b: any): boolean {
    if (a === b) {
      return true;
    }

    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      return a.every((v, i) => a[i].id === b[i].id);
    }

    return false;
  }

  /**
   * Show a string from a value
   */
  public present(value: any) {
    if (Array.isArray(value)) {
      return '\n * ' + value.map(item => item.name).join('\n * ');
    }

    return value;
  }
}
