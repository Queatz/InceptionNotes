import {Injectable} from '@angular/core'
import {environment} from '../environments/environment'

@Injectable()
export class Config {

  dev: boolean = !environment.production

  constructor() {
  }

  getWebSocketUrl() {
    return `ws${environment.apiUrl.slice(4)}/ws`
  }

  getUrl(path: string) {
    return `${environment.apiUrl}/${path}`
  }

  invitationLink(token: string) {
    return `${environment.uiUrl}/invitation/${token}`
  }

  noteLink(id: string) {
    return `${environment.uiUrl}/n/${id}`
  }
}
