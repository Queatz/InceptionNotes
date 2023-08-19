import {Injectable} from '@angular/core'
import {WsService} from 'app/ws.service'
import {Event} from 'app/sync/event'
import {ApiService, FrozenNote, Note} from 'app/api.service'
import util from 'app/util'
import {Conflict, ConflictService} from './conflict.service'
import {Subject} from 'rxjs'

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
  notes: Partial<FrozenNote>[]

  constructor(notes: Partial<FrozenNote>[]) {
    this.notes = notes
  }
}

@Injectable()
export class SyncService {

  private event: Event
  private device?: string

  readonly invitationsChanged = new Subject<void>()

  constructor(private ws: WsService, private api: ApiService, private conflict: ConflictService) {
    this.ws.syncService = this

    this.ws.onBeforeOpen.subscribe(() => {
      this.send(new IdentifyOutgoingEvent(this.deviceToken()))
    })

    this.event = new Event()

    this.conflict.resolutions.subscribe(resolution => {
      const { note, prop, localProp, serverRev } = resolution.conflict
      if (resolution.accept) {
        this.setProp(note, prop, localProp)
        this.api.setSynced(note.id, prop)
        this.updateRevIfSynced(note, serverRev)
      } else {
        // todo: have to stage the serverRev here so that the update response from the server succeeds locally
        note.rev = serverRev
        this.syncLocalProp(note, prop, serverRev)
      }
    })

    this.conflict.conflictsResolved.subscribe(() => {
      this.syncLocalProps()
    })
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
  syncLocalProp(note: Note, prop: string, rev: string) {
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
    // We don't want to send local props until everything from the server is handled
    if (this.conflict.hasConflicts()) {
      return
    }

    const syncAllEvent = new SyncOutgoingEvent([])

    for (const n of this.api.getAllNotes().values()) {
      if (!this.canEdit(n)) {
        continue
      }

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
      this.api.saveNote(note)
    }

    return sync
  }

  /**
   * Handle note prop update from sever
   *
   * Returns list of notes ids that needed to be initialized
   */
  handleUpdateFromServer(note: Note, prop: string, value: any, serverRev: string): string[] {
    const { value: serverProp, init } = this.api.unfreezeProp(note, prop, value)
    if (this.api.isSynced(note, prop) || note[prop] === undefined) {
      // Local prop was provided by server, overwrite
      this.setProp(note, prop, serverProp)
      this.setSynced(note, prop, serverRev)
    } else if (this.valEquals(note[prop], serverProp)) {
      // Local prop was provided by server, ignore
      this.setSynced(note, prop, serverRev)
    } else {
      // Auto merge auto-generated last item
      if (prop === 'items') {
        for (let i = 0; i < note.items.length; i++) {
          let identical = true
          if (note.items[i] !== value[i]) {
            if (!this.api.isEmptyNote(note.items[i])) {
              identical = false
              break
            }
          }
          if (identical) {
            this.setProp(note, prop, serverProp)
            this.setSynced(note, prop, serverRev)
            return init
          }
        }
      } else if (['options'].indexOf(prop) !== -1) {
        // Props with low risk of data loss
        this.setProp(note, prop, serverProp)
        this.setSynced(note, prop, serverRev)
        return init
      } else if (['updated', 'created'].indexOf(prop) !== -1) {
        // Server-only props
        this.setProp(note, prop, serverProp)
        this.setSynced(note, prop, serverRev)
        return init
      }

      // Local prop differs, ask what to do
      this.conflict.addConflict(new Conflict(note, prop, serverProp, serverRev))
    }

    return init
  }

  setSynced(note: Note, prop: string, serverRev: string) {
    this.api.setSynced(note.id, prop)
    this.updateRevIfSynced(note, serverRev)
  }

  setProp(note: Note, prop: string, value: any) {
    if (Array.isArray(note[prop]) && Array.isArray(value)) {
      note[prop].length = 0
      note[prop].push(...value)
    } else {
      if (prop === 'name' && !value) {
        note[prop] = ''
      } else if (prop === 'items' && !value) {
        note[prop] = []
      } else {
        note[prop] = value
      }
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

  setNoteRev(id: string, rev: string, oldRev: string): boolean {
    this.conflict.setNoteServerRev(id, rev)
    return this.api.setNoteRev(id, rev, oldRev)
  }

  setGone(noteId: string) {
    const note = this.api.search(noteId)

    if (note) {
      note._sync = false
      this.api.saveNote(note)
    }
  }

  setCanEdit(noteId: string, canEdit: boolean) {
    const note = this.api.search(noteId)

    if (note) {
      if (canEdit) {
        delete note._edit
      } else {
        note._edit = false
      }
      this.api.saveNote(note)
    }
  }

  setCanEditFull(allViewOnlyNotes: string[], allServerKnownNoteIds: string[]) {
    for (const note of this.api.getAllNotes().values()) {
      if (note._edit === false && allViewOnlyNotes.indexOf(note.id) === -1 && allServerKnownNoteIds.indexOf(note.id) !== -1) {
        this.setCanEdit(note.id, true)
      }
    }
  }

  canEdit(note: Note) {
    return note._edit !== false
  }

  sendState() {
    const notes: Array<[string, string]> = []

    for (const note of this.api.getAllNotes().values()) {
      if (note.rev && note._sync !== false) {
        notes.push([note.id, note.rev])
      }
    }

    this.send(new StateOutgoingEvent(notes))
  }

  private updateRevIfSynced(note: Note, serverRev: string) {
    if (this.api.allPropsAreSynced(note)) {
      note.rev = serverRev
      this.api.saveNote(note)
    }
  }

  reloadInvitations() {
    this.invitationsChanged.next()
  }
}
