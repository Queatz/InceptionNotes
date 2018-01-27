import { Injectable } from '@angular/core';
import { Config } from 'app/config.service';
import { WsService } from 'app/ws.service';
import { Event, SyncEvent } from 'app/sync/event';

@Injectable()
export class SyncService {

  private me: string;
  private event: Event;

  constructor(private ws: WsService) {
    this.ws.syncService = this;
    this.event = new Event();
  }

  /**
   * Start syncing
   */
  public start(me: string) {
    this.me = me;
    this.send(new SyncEvent(me));
  }

  /**
   * Send
   */
  public send(event: any) {
    let str = JSON.stringify([[this.event.types.get(event.constructor), event]]);
    console.log('(ws) send: ' + str);    
    this.ws.send(str);
  }

  /**
   * Called on got
   */
  public got(events: any[]) {
    console.log('(ws) event: ' + JSON.stringify(events));
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
