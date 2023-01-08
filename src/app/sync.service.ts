import {Injectable} from '@angular/core'
import {WsService} from 'app/ws.service'
import {Event} from 'app/sync/event'
import {ApiService, FrozenNote, Note} from 'app/api.service'
import util from 'app/util'
import {UiService} from 'app/ui.service'
import {el} from 'date-fns/locale';

export class IdentifyOutgoingEvent {
  device: string

  constructor(device: string) {
    this.device = device
  }
}

export class StateOutgoingEvent {
  notes: Array<[string, string]>

  constructor(notes: Array<[string, string]>) {
    this.notes = notes
  }
}

export class GetOutgoingEvent {
  notes: Array<string>

  constructor(notes: Array<string>) {
    this.notes = notes
  }
}

export class SyncOutgoingEvent {
  notes: FrozenNote[]

  constructor(notes: FrozenNote[]) {
    this.notes = notes
  }
}

@Injectable()
export class SyncService {

  private event: Event
  private device?: string

  constructor(private ws: WsService, private api: ApiService, private ui: UiService) {
    this.ws.syncService = this

    this.ws.onBeforeOpen.subscribe(() => {
      this.send(new IdentifyOutgoingEvent(this.deviceToken()))
    })

    this.event = new Event()
  }

  deviceToken(): string {
    if (!this.device) {
      this.device = localStorage.getItem('device')

      if (!this.device) {
        this.device = util.newKey()
        localStorage.setItem('device', this.device)
      }
    }

    return this.device
  }

  /**
   * Start syncing
   */
  start() {
    this.ws.reconnect()

    this.api.onNoteChangedObservable.subscribe(change => {
      if (!this.ws.active()) {
        return
      }

      if (change.property === null) {
        this.send(new SyncOutgoingEvent([this.api.freezeNote(change.note, true)]))
      } else {
        if (change.note[change.property] === undefined) {
          return
        }

        this.send(new SyncOutgoingEvent([
          this.api.freezeNote(
            {
              id: change.note.id,
              rev: change.note.rev,
              [change.property]: change.note[change.property]
            },
            true
          )
        ]))
      }
    })
  }

  /**
   * Sync a local prop from a server rev
   */
  syncLocalProp(note: Note, prop: string, rev: string | null) {
    const p: Partial<Note> = {
      id: note.id,
      rev,
      [prop]: note[prop]
    }
    this.send(new SyncOutgoingEvent([ this.api.freezeNote(p, true) ]))
  }

  /**
   * Sync all new notes and changed props
   */
  syncLocalProps() {
    const syncAllEvent = new SyncOutgoingEvent([])

    for (const n of this.api.getAllNotes().values()) {
      if (!n._local) {
        syncAllEvent.notes.push(this.api.freezeNote(n, true))
      } else if (n._local.length > 0) {
        const p: Partial<Note> = {
          id: n.id,
          rev: n.rev,
        }
        for (const k of n._local) {
          p[k] = n[k]
        }

        syncAllEvent.notes.push(this.api.freezeNote(p, true))
      }
    }

    if (syncAllEvent.notes.length) {
      this.send(syncAllEvent)
    }
  }

  /**
   * Send
   */
  send(event: any) {
    this.ws.send([[this.event.outgoingTypes.get(event.constructor), event]])
  }

  /**
   * Called on got
   */
  got(events: [[string, any]]) {
    events.forEach((event: [string, any]) => {
      const t = this.event.actions.get(event[0])
      event[1].__proto__ = t.prototype
      event[1].got(this)
    })
  }

  /**
   * Handle note update from server
   *
   * Returns list of notes that needed to be initialized
   */
  handleNoteFromServer(n: FrozenNote, full: boolean): string[] {
    const sync: string[] = []
    let note = this.api.search(n.id)
    if (!note) {
      sync.push(n.id)
      if (full) {
        note = this.api.newBlankNote(true, n.id)
      } else {
        // We got a partial update for a note we don't have, sync state
        return sync
      }
    }

    Object.keys(n).forEach(prop => {
      if (prop === 'id' || prop === 'rev') {
        return
      }
      sync.push(...this.handleUpdateFromServer(note, prop, n[prop], n.rev))
    })

    // If there were no conflicts, all props should be synced, safe to update rev
    if (this.api.allPropsAreSynced(note)) {
      note.rev = n.rev
    }

    return sync
  }

  /**
   * Handle note prop update from sever
   *
   * Returns list of notes that needed to be initialized
   */
  handleUpdateFromServer(note: Note, prop: string, value: any, serverRev: string): string[] {
    const { value: localProp, init } = this.api.unfreezeProp(note, prop, value)
    if (this.api.isSynced(note, prop)) {
      // Local prop was provided by server, overwrite
      this.setProp(note, prop, localProp)
      this.api.setSynced(note.id, prop)
    } else if (this.valEquals(note[prop], localProp)) {
      // Local prop was provided by server, ignore
      this.api.setSynced(note.id, prop)
    } else {
      // Auto merge auto-generated last item
      if (prop === 'items') {
        if (Math.abs(note.items.length - value.length) <= 1) {
          let equal = true
          for (let i = 0; i < Math.min(note.items.length, value.length); i++) {
            if (note.items[i] !== value[i]) {
              equal = false
              break
            }
          }

          if (equal) {
            if (note.items.length > value.length) {
               if (this.api.isEmptyNote(note.items[note.items.length - 1])) {
                 this.syncLocalProp(note, prop, serverRev)
               }
            } else {
              if (this.api.isEmptyNote(value[value.length - 1])) {
                this.setProp(note, prop, localProp)
                this.api.setSynced(note.id, prop)
                if (this.api.allPropsAreSynced(note)) {
                  note.rev = serverRev
                }
              }
            }

            return init
          }
        }
      }

      // Local prop differs, ask what to do
      this.ui.dialog({
        message: `${note.name}\n\nOverwrite ${prop} "${this.present(note[prop])}" with "${this.present(localProp)}"?`,
        ok: () => {
          // Accept server version
          this.setProp(note, prop, localProp)
          this.api.setSynced(note.id, prop)
          if (this.api.allPropsAreSynced(note)) {
            note.rev = serverRev
          }
        },
        cancel: () => {
          this.syncLocalProp(note, prop, serverRev)
        }
      })
    }

    return init
  }

  setProp(note: Note, prop: string, value: any) {
    if (Array.isArray(note[prop]) && Array.isArray(value)) {
      note[prop].length = 0
      note[prop].push(...value)
    } else {
      note[prop] = value
    }
  }

  /**
   * Return if a value is equal.
   */
  valEquals(a: any, b: any): boolean {
    if (a === b) {
      return true
    }

    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      return a.every((v, i) => this.valEquals(a[i], b[i]))
    }

    return false
  }

  /**
   * Show a string from a value
   */
  present(value: any) {
    if (Array.isArray(value)) {
      return '\n * ' + value.map(item => item.name).join('\n * ') + '\n'
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return value
  }

  setNoteRev(id: string, rev: string, oldRev: string): boolean {
    return this.api.setNoteRev(id, rev, oldRev)
  }

  sendState() {
    const notes: Array<[string, string]> = []

    for (const note of this.api.getAllNotes().values()) {
      if (note.rev) {
        notes.push([note.id, note.rev])
      }
    }

    this.send(new StateOutgoingEvent(notes))
  }
}
