import {Injectable} from '@angular/core'
import {environment} from '../environments/environment'

@Injectable()
export class Config {

  beta: boolean = !environment.production

  constructor() {
  }

  getWebSocketUrl() {
    if (this.beta) {
      return 'ws://localhost:8080/ws'
    } else {
      return 'wss://api.inceptionnotes.com/ws'
    }
  }

  getUrl(path: string) {
    if (this.beta) {
      return `http://localhost:8080/${path}`
    } else {
      return `https://api.inceptionnotes.com/${path}`
    }
  }

  invitationLink(token: string) {
    if (this.beta) {
      return `http://localhost:4200/invitation/${token}`
    } else {
      return `https://inceptionnotes.com/invitation/${token}`
    }
  }

  noteLink(id: string) {
    if (this.beta) {
      return `http://localhost:4200/n/${id}`
    } else {
      return `https://inceptionnotes.com/n/${id}`
    }
  }
}
