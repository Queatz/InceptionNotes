import {Injectable} from '@angular/core'
import {environment} from '../environments/environment'

@Injectable()
export class Config {

  beta: boolean = !environment.production
  logWs: boolean = !environment.production
  betaVlllage = false

  constructor() {
  }

  public getWebSocketUrl() {
    if (this.beta) {
      return 'ws://localhost:8080/sync/ws'
    } else {
      return 'wss://sync.inceptionnotes.com/ws'
    }
  }

  public getHttpUrl() {
    if (this.beta) {
      return 'http://localhost:8080/sync/http'
    } else {
      return 'https://sync.inceptionnotes.com/http'
    }
  }

  public vlllageAuthenticateUrl() {
    return this.betaVlllage ? 'http://localhost:3000/authenticate' : 'https://vlllage.com/authenticate'
  }

  public vlllageStoreUrl() {
    return this.betaVlllage ? 'http://localhost:8080/api/earth/app/store' : 'https://vlllage.com:8443/api/earth/app/store'
  }

  public vlllageUrl() {
    return this.betaVlllage ? 'http://localhost:3000/' : 'https://vlllage.com/'
  }

  public vlllageFriends(id: string, auth: string) {
    if (this.betaVlllage) {
      return 'http://localhost:8080/api/earth/' + id + '?select=backs(source(firstName,lastName,imageUrl,googleUrl)'
    }

    return 'https://vlllage.com:8443/api/earth/' + id + '?select=backs(source(firstName,lastName,imageUrl,googleUrl))'
  }
}
