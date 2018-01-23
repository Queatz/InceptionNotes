import { Injectable } from '@angular/core';

@Injectable()
export class Config {

  private beta: boolean = true;

  constructor() { }

  public getWebSocketUrl() {
    if (this.beta) {
      return 'ws://localhost:8080/sync/ws';
    } else {
      return 'wss://sync.inceptionnotes.com/ws';
    }
  }

  public vlllageAuthenticateUrl() {
    return this.beta ? 'http://localhost:3000/authenticate' : 'https://vlllage.com/authenticate';
  }

  public vlllageStoreUrl() {
    return this.beta ? 'http://localhost:8080/api/earth/app/store' : 'https://vlllage.com:8443/api/earth/app/store';
  }

  public friends(id: string, auth: string) {
    if (this.beta) {
      return 'http://localhost:8080/api/earth/' + id + '?select=backs(source(firstName,lastName))&auth=' + auth;
    }

    return 'https://vlllage.com:8443/api/earth/' + id + '?select=backs(source(firstName,lastName))&auth=' + auth;
  }
}
