import { Injectable } from '@angular/core';
import { Http, Headers, Response, RequestOptions } from '@angular/http';
import { Observable } from 'rxjs';
import 'rxjs/add/operator/map'

import { ApiService } from './api.service';
import { UiService } from './ui.service';

@Injectable()
export class VillageService {

  private beta = true;
  private url: string = this.beta ? 'http://localhost:3000/authenticate' : 'https://vlllage.com/authenticate';
  private storeUrl: string = this.beta ? 'http://localhost:8080/api/earth/app/store' : 'https://vlllage.com:8443/api/earth/app/store';
  private listener: any;
  private villageFrame: any;
  private interval: any;
  private found: boolean;
  private connected: boolean;
  private data: any = null;

  constructor(private http: Http, private api: ApiService, private ui: UiService) {
    var local = JSON.parse(localStorage.getItem('village'));

    if (local) {
      this.data = local;
      this.connected = true;
      this.found = true;
    }
  }


  public save() {
    this.put('notes', { eye: this.api.getEye().id, notes: this.api.getFrozenNotes() }).subscribe(result => {
      if (result.success) {
        this.ui.dialog({
          message: 'All notes successfully saved in Village'
        });
      } else {
        this.ui.dialog({
          message: 'Save didn\'t work'
        });
      }
    });
  }

  public load() {
    this.get('notes').subscribe(obj => {
      this.api.loadFrozenNotes(obj.notes);
      this.api.setEye(this.api.search(obj.eye));
      this.ui.dialog({
        message: 'All notes successfully loaded from Village'
      });
    }, err => {
      if (err.status === 404) {
        this.ui.dialog({
          message: 'There are no notes saved in Village'
        });
      } else {
        this.ui.dialog({
          message: 'Village sync didn\'t work because of a server error.\n\nYou might want to try again after disconnecting Village from the options.'
        });
      }
    });
  }

  // XXX todo
  private sync() {
    // Pull, then push
    this.get('notes').subscribe(obj => this.syncCheck(obj), err => {
      if (err.status === 404) {
        this.syncOk();
      } else {
        this.ui.dialog({
          message: 'Village sync didn\'t work because of a server error.\n\nYou might want to try again after disconnecting Village from the options.'
        });
      }
    });
  }

  syncCheck(obj: any) {
    if (this.compare(this.api.getAllNotes(), obj)) {
      this.api.upsertNotes(JSON.stringify(obj));
      this.syncOk();
    } else {
      this.ui.dialog({
        message: 'Village is out of sync. Overwrite from Village?',
        ok: () => {
          this.api.loadFrozenNotes(JSON.stringify(obj));
        }
      });
    }
  }

  syncOk() {
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

  compare(current: any, foreign: any) {
    for(let n in current) {
      if (current[n].id in foreign) {
        if (current[n].name && current[n].name.indexOf(foreign[n].name) === -1) {
          return false;
        }
      }
    }

    return true;
  }

  put(k: string, v: any) {
    return this.http.post(this.storeUrl + (k ? '?q=' + k : ''), v, this.options())
        .map((res: Response) => res.json());
  }

  get(k: string) {
    return this.http.get(this.storeUrl + (k ? '?q=' + k : ''), this.options())
        .map((res: Response) => res.json());
  }

  private options() {
    return new RequestOptions({ headers: new Headers({
      'Authorization': this.data.token,
      'Content-Type': 'application/json'
    }) });
  }

  isConnected() {
    return this.connected;
  }

  disconnect() {
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

  me() {
    return this.data;
  }

  connect() {
    this.found = undefined;

    if (this.connected) {
      return;
    }

    this.connected = true;

    if (!this.villageFrame) {
      this.villageFrame = document.createElement('iframe');
      this.villageFrame.setAttribute('src', this.url);
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
          receiver.postMessage('com.vlllage.message.hey', this.url);
        };
        setInterval(this.interval, 500);
      }
    }
  }

}
