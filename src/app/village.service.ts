import { Injectable } from '@angular/core';
import { Http, Headers, Response, RequestOptions } from '@angular/http';
import { Observable } from 'rxjs';
import 'rxjs/add/operator/map'

import { ApiService } from './api.service';
import { UiService } from './ui.service';
import { CollaborateService } from './collaborate.service';
import { Config } from 'app/config.service';

@Injectable()
export class VillageService {

  private listener: any;
  private villageFrame: any;
  private interval: any;
  private found: boolean;
  private connected: boolean;
  private data: any = null;

  constructor(private http: Http, private config: Config, private api: ApiService, private ui: UiService, private collaborate: CollaborateService) {
    var local = JSON.parse(localStorage.getItem('village'));

    if (local) {
      this.data = local;
      this.connected = true;
      this.found = true;
    }
  }

  /* Sync - see SYNC.md */

  public sync() {
    // Pull, then push
    this.get('notes').subscribe(obj => this.syncCheck(obj), err => {
      if (err.status === 404) {
        this.pushNow();
      } else {
        this.ui.dialog({
          message: 'Village sync didn\'t work because of a server error.\n\nYou might want to try again after disconnecting Village from the options.'
        });
      }
    });
  }

  private syncCheck(obj: any) {
    obj = this.api.unfreeze(obj);

    this.collaborate.syncAll(this.api.getAllNotes(), obj)
      .then(() => this.pushNow())
      .catch((err) => {
        this.ui.dialog({
          message: 'Sync failed due to merge conflicts.\n\n' + err
        });

        console.error(err);
      });
  }

  private pushNow() {
    let notes = this.api.getAllNotes();
    Object.keys(notes).forEach(note => Object.keys(notes[note]).forEach(k => k !== '_sync' ? this.collaborate.setSynchronized(notes[note], k) : null ));
    this.api.save();

    this.put('notes', this.api.getFrozenNotes()).subscribe(result => {
      if (result.success) {
        this.ui.dialog({
          message: 'Village has been sync\'d'
        });
      } else {
        this.ui.dialog({
          message: 'Village sync didn\'t work this time'
        });
      }
    });
  }

  public nuke() {
    this.ui.dialog({
      message: 'Remove all notes from Village?',
      ok: () => this.put('notes', {}).subscribe(() => this.ui.dialog({
        message: 'Notes successfully removed from Village.\n\nTo access these notes on another device, use the file backup and load feature, or reconnect Village and sync.'
      }))
    });
  }

  /* Connect */

  public isConnected() {
    return this.connected;
  }

  public disconnect() {
    this.data = null;
    this.connected = false;

    if (this.listener) {
      window.removeEventListener('message', this.listener, false);
      this.listener = null;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.villageFrame) {
      this.villageFrame.remove();
      this.villageFrame = null;
    }

    localStorage.removeItem('village');
  }

  public me() {
    return this.data;
  }

  public connect() {
    this.found = undefined;

    if (this.connected) {
      return;
    }

    this.connected = true;

    if (!this.villageFrame) {
      this.villageFrame = document.createElement('iframe');
      this.villageFrame.setAttribute('src', this.config.vlllageAuthenticateUrl());
      this.villageFrame.style.width = '0';
      this.villageFrame.style.height = '0';
      this.villageFrame.style.visibility = 'hidden';
      document.body.appendChild(this.villageFrame);
    }

    if (!this.listener) {
      this.listener = event => {
          if (event.data && event.data.me !== undefined) {
            if (event.data.me) {
              this.data = event.data.me;
              localStorage.setItem('village', JSON.stringify(this.data));

              if (this.found) {
                return;
              }
              this.found = true;
              this.ui.dialog({
                message: 'Hey ' + event.data.me.firstName + '!',
              });
            } else {
              if (this.found === false) {
                return;
              }
              this.found = false;
              this.ui.dialog({
                message: 'You are not currently signed into Village.',
              });
            }
          }
        };

      window.addEventListener('message', this.listener, false);

      var receiver = this.villageFrame.contentWindow;

      if (receiver) {
        this.interval = () => {
          receiver.postMessage('com.vlllage.message.hey', this.config.vlllageAuthenticateUrl());
        };
        setInterval(this.interval, 500);
      }
    }
  }

  /* Network */

  private put(k: string, v: any) {
    return this.http.post(this.config.vlllageStoreUrl() + (k ? '?q=' + k : ''), v, this.options())
        .map((res: Response) => res.json());
  }

  private get(k: string) {
    return this.http.get(this.config.vlllageStoreUrl() + (k ? '?q=' + k : ''), this.options())
        .map((res: Response) => res.json());
  }

  private options() {
    return new RequestOptions({ headers: new Headers({
      'Authorization': this.data.token,
      'Content-Type': 'application/json'
    }) });
  }
}
