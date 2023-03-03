import {Injectable} from '@angular/core'
import {HttpClient} from '@angular/common/http'
import {Config} from 'app/config.service'
import {SyncOutgoingEvent, SyncService} from 'app/sync.service'
import {debounce, interval, Subject} from 'rxjs'
import {FrozenNote} from './api.service'
import {UiService} from './ui.service';

@Injectable()
export class WsService {

  private websocket: WebSocket
  private pending: any[] = []
  private buffered: Array<[string, any]> = []
  private _buffered = new Subject<void>()
  private isInActiveHttpSync = false
  private shouldHttpSyncAgain = false

  // Injections
  public syncService: SyncService

  // Events
  public onBeforeOpen: Subject<void> = new Subject()

  constructor(private config: Config, private http: HttpClient, private ui: UiService) {
    setTimeout(() => {
      this.reconnect()
    }, 5000)

    this._buffered.pipe(
      debounce(() => interval(ui.getEnv().syncInterval || 500))
    ).subscribe(() => {
      if (this.buffered.length) {
        this.send(this.mergeEvents(this.buffered), false, false)
        this.buffered.length = 0
      }
    })
  }

  active(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN
  }

  reconnect() {
    if (this.websocket?.readyState === WebSocket.OPEN || this.websocket?.readyState === WebSocket.CONNECTING) {
      return
    }

    this.websocket = new WebSocket(this.config.getWebSocketUrl())
    this.websocket.onmessage = message => this.onMessage(message.data)
    this.websocket.onopen = () => this.onOpen()
    this.websocket.onclose = event => {
      this.onClose(event.code === 1000)
    }
  }

  close() {
    this.websocket?.close()
  }

  send(events: any[], forceHttp = false, useBuffer = true): boolean {
    if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
      this.reconnect()
    }

    if (this.websocket?.readyState !== WebSocket.OPEN) {
      this.pending.push(events)

      return false
    }

    const message = JSON.stringify(events)

    if (message.length < 1000 && !forceHttp) {
      if (!useBuffer) {
        this.websocket.send(message)
      } else {
        this.buffered.push(...events)
        this._buffered.next()
      }
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

  /**
   * Merges all events on the same note, keeping the values from the latest events.
   */
  private mergeEvents(events: Array<[string, any]>): any[] {
    if (!events.length) {
      return []
    }

    const syncEvents = events.filter(it => it[0] === 'sync')
    const atomicEvents = events.filter(it => it[0] !== 'sync')
    const mergedSyncEvents = this.mergeSyncEvents(syncEvents)
    return [...mergedSyncEvents, ...atomicEvents]
  }

  private mergeSyncEvents(events: Array<[string, any]>): Array<[string, any]> {
    if (!events.length) {
      return []
    }
    const eventsByNote = new Map<string, Partial<FrozenNote>>()
    events.map(event => event[1] as SyncOutgoingEvent).forEach(event => {
      event.notes.forEach(frozenNote => {
        if (!eventsByNote.has(frozenNote.id)) {
          eventsByNote.set(frozenNote.id, {} as FrozenNote)
        }
        eventsByNote.set(
          frozenNote.id,
          Object.assign(
            eventsByNote.get(frozenNote.id),
            frozenNote
          )
        )
      })
    })

    return [
      [
        'sync',
        new SyncOutgoingEvent(Array.from(eventsByNote.values()))
      ]
    ]
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
      }, 1000)
    }
  }

  private onMessage(message: string) {
    this.syncService.got(JSON.parse(message))
  }
}
