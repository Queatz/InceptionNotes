import { Injectable } from '@angular/core';
import { Http, Headers, Response, RequestOptions } from '@angular/http';
import { Observable, Subject } from 'rxjs';
import 'rxjs/add/operator/map'

import { ApiService } from './api.service';
import { UiService } from './ui.service';
import { CollaborateService } from './collaborate.service';
import { Config } from 'app/config.service';
import { SyncService } from 'app/sync.service';

@Injectable()
export class VillageService {

  private static VLLLAGE_ME_KEY = 'me';

  private listener: any;
  private villageFrame: any;
  private interval: any;
  private found: boolean;
  private connected: boolean;
  private data: any = null;
  private meId: string = null;

  private friendsObservable: Subject<any[]>;
  private backers: any[];

  constructor(private http: Http,
      private config: Config,
      private api: ApiService,
      private ui: UiService,
      private collaborate: CollaborateService,
      private syncService: SyncService) {
    var local = JSON.parse(localStorage.getItem('village'));

    if (local) {
      this.data = local;
      this.connected = true;
      this.found = true;
    }

    this.friendsObservable = new Subject();
  }

  /* Sync - see SYNC.md */

  /**
   * Check
   */
  public check() {
    if (this.me()) {
      this.sync();
    }
  }

  public sync() {
    this.get(VillageService.VLLLAGE_ME_KEY).subscribe(me => me ? this.onMeAvailable(me) : this.setup(), err => {
      if (err.status === 404) {
        this.setup();
      } else {
        this.ui.dialog({
          message: 'Village connection didn\'t work because of a server error.\n\nYou might want to try again after disconnecting Village from the options.'
        });
      }
    });
  }

  private setup() {
    let me = this.newKey();
    this.put(VillageService.VLLLAGE_ME_KEY, JSON.stringify(me)).subscribe(success => {
      this.onMeAvailable(me);
    }, err => {
      this.ui.dialog({
        message: 'Village connection didn\'t work because of a server error.\n\nYou might want to try again after disconnecting Village from the options.'
      });
    });
  }

  private onMeAvailable(me: string) {
    this.meId = me;
    this.syncService.start(me);
  }

  private newKey() {
    return Array.from(Array(10)).reduce(a => a + Math.random().toString(36).substring(2, 15), '');
  }

  public nuke() {
    this.ui.dialog({
      message: 'Unsync notes from Village?',
      ok: () => this.put(VillageService.VLLLAGE_ME_KEY, JSON.stringify(null)).subscribe(() => this.ui.dialog({
        message: 'Notes successfully unsync\'d from Village.\n\nTo access these notes on another device, use the file backup and load feature.'
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
              this.sync();
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

  public friends(k: string): Observable<any[]> {
    k = k.toLowerCase();

    if (this.backers) {
      let backs = this.backers.filter(p => p.firstName.toLowerCase().indexOf(k) !== -1);
      return Observable.of(backs);
    } else {
      this.http.get(this.config.vlllageFriends(this.me().id, this.me().token), this.options())
          .map((res: Response) => res.json()).subscribe(person => {
            this.backers = person.backs.map(back => back.source);
            let backs = this.backers.filter(p => p.firstName.toLowerCase().indexOf(k) !== -1);
            this.friendsObservable.next(backs);
          });
    }

    return this.friendsObservable.first();
  }

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
