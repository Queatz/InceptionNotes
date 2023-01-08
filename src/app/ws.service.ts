import {Injectable} from '@angular/core'
import {HttpClient} from '@angular/common/http'
import {Config} from 'app/config.service'
import {SyncService} from 'app/sync.service'
import {Subject} from 'rxjs'

@Injectable()
export class WsService {

  private websocket: WebSocket
  private pending: any[] = []
  private isInActiveHttpSync = false
  private shouldHttpSyncAgain = false

  // Injections
  public syncService: SyncService

  // Events
  public onBeforeOpen: Subject<any> = new Subject()

  constructor(private config: Config, private http: HttpClient) {
  }

  active(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN
  }

  reconnect() {
    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING) {
        return
      }
    }

    this.websocket = new WebSocket(this.config.getWebSocketUrl())
    this.websocket.onmessage = message => this.onMessage(message.data)
    this.websocket.onopen = () => this.onOpen()
    this.websocket.onclose = event => {
      this.onClose(event.code !== 1000)
    }
  }

  close() {
    this.websocket?.close()
  }

  send(events: any[], forceHttp = false): boolean {
    if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
      this.reconnect()
    }

    if (this.websocket.readyState !== WebSocket.OPEN) {
      this.pending.push(events)

      return false
    }

    const message = JSON.stringify(events)

    if (message.length < 1000 && !forceHttp) {
      this.websocket.send(message)
    } else {
      if (this.isInActiveHttpSync) {
        this.shouldHttpSyncAgain = true
      } else {
        this.isInActiveHttpSync = true
        this.shouldHttpSyncAgain = false
        this.http.post(this.config.getUrl('http'), message, {
          headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'Authorization': `Bearer ${this.syncService.deviceToken()}`
          }
        }).subscribe(
          {
            next: (m: [[string, any]]) => {
              this.isInActiveHttpSync = false
              if (this.shouldHttpSyncAgain) {
                this.send([], true) // todo should it actually be []?
              }
              this.syncService.got(m)
            },
            error: error => {
              this.isInActiveHttpSync = false
              if (this.shouldHttpSyncAgain) {
                this.send([], true) // todo should it actually be []?
              }
              console.log(error)
            }
          }
        )
      }
    }

    return true
  }

  private onOpen() {
    this.onBeforeOpen.next(null)

    while (this.pending.length) {
      this.send(this.pending.shift())
    }
  }

  private onClose(wasNormal: boolean) {
    if (!wasNormal) {
      setTimeout(() => {
        this.reconnect()
      }, 2000)
    }
  }

  private onMessage(message: string) {
    this.syncService.got(JSON.parse(message))
  }
}
