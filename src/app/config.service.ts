import {Injectable} from '@angular/core'
import {environment} from '../environments/environment'

@Injectable()
export class Config {

  beta: boolean = !environment.production
  logWs: boolean = !environment.production

  constructor() {
  }

  public getWebSocketUrl() {
    if (this.beta) {
      return 'ws://localhost:8080/ws'
    } else {
      return 'wss://api.inceptionnotes.com/ws'
    }
  }

  public getUrl(path: string) {
    if (this.beta) {
      return `http://localhost:8080/${path}`
    } else {
      return `https://api.inceptionnotes.com/${path}`
    }
  }
}
