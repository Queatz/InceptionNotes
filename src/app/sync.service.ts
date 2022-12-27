import {Injectable} from '@angular/core'
import {Config} from 'app/config.service'
import {WsService} from 'app/ws.service'
import {Event, StateEvent} from 'app/sync/event'
import {ApiService, FrozenNote, Invitation, Note} from 'app/api.service'
import util from 'app/util'
import {UiService} from 'app/ui.service'

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

export class SyncOutgoingEvent {
  notes: FrozenNote[]

  constructor(notes: FrozenNote[]) {
    this.notes = notes
  }
}

@Injectable()
export class SyncService {

  private me: Invitation
  private event: Event
  private device?: string

  constructor(private ws: WsService, private api: ApiService, private ui: UiService, private config: Config) {
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
  public start() {
    this.ws.reconnect()

    this.api.onNoteChangedObservable.subscribe(change => {
      if (!this.ws.active()) {
        return
      }

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
    })
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
   * Identify with invitation
   */
  setInvitation(me: Invitation) {
    this.me = me
  }

  /**
   * Send
   */
  public send(event: any) {
    this.ws.send([[this.event.outgoingTypes.get(event.constructor), event]])
  }

  /**
   * Called on got
   */
  public got(events: [[string, any]]) {
    events.forEach((event: [string, any]) => {
      if (this.config.logWs) {
        console.log('got', event)
      }
      const t = this.event.actions.get(event[0])
      event[1].__proto__ = t.prototype
      event[1].got(this)
    })
  }

  /**
   * Handle note prop update from sever
   * todo
   */
  public handleUpdateFromServer(noteId: string, prop: string, value: any) {
    let note = this.api.search(noteId)

    if (!note) {
      note = this.api.newBlankNote(true, noteId)
    }

    const localProp = this.api.unfreezeProp(note, prop, value)
    if (note[prop] === undefined || this.api.isSynced(note, prop)) {
      this.setProp(note, prop, localProp)
      this.api.setSynced(note.id, prop)
    } else if (this.valEquals(note[prop], localProp)) {
      this.api.setSynced(note.id, prop)
    } else {
      this.ui.dialog({
        message: 'Overwrite ' + prop + ' "' + this.present(note[prop]) + '" with "' + this.present(localProp) + '"',
        ok: () => {
          this.setProp(note, prop, localProp)
          this.api.setSynced(note.id, prop)
        },
        cancel: () => {
          this.send(new SyncOutgoingEvent([this.api.freezeNote(
            {
              id: note.id,
              rev: note.rev,
              [prop]: note[prop]
            },
            true
          )]))
        }
      })
    }
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
   * todo
   */
  public valEquals(a: Note, b: Note): boolean {
    if (a === b) {
      return true
    }

    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      return a.every((v, i) => this.isSameOrTransient(a[i], b[i]))
    }

    return false
  }

  /**
   * Determine if a note prop is safe to overwrite
   * todo
   */
  isSameOrTransient(a: Note, b: Note) {
    return a.id === b.id || ((!a.items || !a.items.length) && (!a.ref || !a.ref.length) && (!a.invitations || !a.invitations.length))
  }

  /**
   * Show a string from a value
   * todo
   */
  public present(value: Note) {
    if (Array.isArray(value)) {
      return '\n * ' + value.map(item => item.name).join('\n * ') + '\n'
    }

    return value
  }

  setNoteRev(id: string, rev: string) {
    this.api.setNoteRev(id, rev)
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
