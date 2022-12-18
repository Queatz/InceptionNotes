import {Injectable} from '@angular/core'
import {HttpClient} from '@angular/common/http'
import {Config} from 'app/config.service'
import {SyncService} from 'app/sync.service'
import {Subject} from 'rxjs'

@Injectable()
export class WsService {

  private websocket: WebSocket
  private pending: any[] = []
  private lastReconnectAttempt: number
  private isInActiveHttpSync = false
  private shouldHttpSyncAgain = false

  // Injections
  public syncService: SyncService

  // Events
  public onBeforeOpen: Subject<any> = new Subject()

  constructor(private config: Config, private http: HttpClient) {
  }

  public active() {
    return this.websocket && this.websocket.readyState === WebSocket.OPEN
  }

  public reconnect() {
    if (new Date().getTime() - this.lastReconnectAttempt < 10000) {
      return
    }

    this.lastReconnectAttempt = new Date().getTime()

    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN || this.websocket.readyState === WebSocket.CONNECTING) {
        return
      }
    }

    this.websocket = new WebSocket(this.config.getWebSocketUrl())
    this.websocket.onmessage = message => this.onMessage(message.data)
    this.websocket.onopen = () => this.onOpen()
    this.websocket.onclose = () => this.onClose()
  }

  public close() {
    if (this.websocket) {
      this.websocket.close()
    }
  }

  public send(events: any, forceHttp = false): boolean {
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
        this.http.post(this.config.getHttpUrl(), message, {
          headers: {
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: this.syncService.clientKey()
          }
        }).subscribe({
          next: (m: any) => {
            this.isInActiveHttpSync = false
            if (this.shouldHttpSyncAgain) {
              this.send([], true)
            }
            this.syncService.got(m)
          },
          error: error => {
            this.isInActiveHttpSync = false
            if (this.shouldHttpSyncAgain) {
              this.send([], true)
            }
            console.log(error)
          }
        })
      }
    }

    return true
  }

  private onOpen() {
    this.onBeforeOpen.next(null)

    while (this.pending.length) {
      this.send(this.pending.shift())
    }

    this.syncService.open()
  }

  private onClose() {
    this.syncService.close()
  }

  private onMessage(message: string) {
    this.syncService.got(JSON.parse(message))
  }
}
