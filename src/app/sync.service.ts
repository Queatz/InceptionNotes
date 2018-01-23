import { Injectable } from '@angular/core';
import { Config } from 'app/config.service';

@Injectable()
export class SyncService {

  private websocket: WebSocket;
  private pending: any[] = [];

  constructor(private config: Config) {
    this.reconnect();
  }

  public reconnect() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      return;
    }

    this.websocket = new WebSocket(this.config.getWebSocketUrl());
    this.websocket.onmessage = message => this.onMessage(message.data);
    this.websocket.onopen = () => this.onOpen();
    this.websocket.onclose = () => this.onClose();
  }

  public send(events: any): boolean {
    if (this.websocket.readyState !== WebSocket.CLOSED) {
      this.reconnect();
    }

    if (this.websocket.readyState !== WebSocket.OPEN) {
      this.pending.push(events);

      return false;
    }

    this.websocket.send(JSON.stringify(events));
    
    return true;
  }

  private onOpen() {
    while(this.pending.length) {
      this.send(this.pending.shift());
    }
  }

  private onClose() {

  }

  private onMessage(message: string) {
    
  }

}
