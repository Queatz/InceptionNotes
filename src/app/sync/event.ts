import {GetOutgoingEvent, IdentifyOutgoingEvent, StateOutgoingEvent, SyncOutgoingEvent, SyncService} from 'app/sync.service'
import {FrozenNote, Invitation} from '../api.service'

export interface ServerEvent {
  got(sync: SyncService): void
}

export class Event {
  types = new Map<any, string>()
  actions = new Map<string, any>()
  outgoingTypes = new Map<any, string>()
  outgoingActions = new Map<string, any>()

  constructor() {
    this.types.set(SyncEvent, 'sync')
    this.types.set(StateEvent, 'state')
    this.types.set(IdentifyEvent, 'identify')
    this.types.set(GetEvent, 'get')
    this.types.set(InvitationEvent, 'invitation')
    this.types.forEach((v, k) => this.actions.set(v, k))
    this.outgoingTypes.set(IdentifyOutgoingEvent, 'identify')
    this.outgoingTypes.set(StateOutgoingEvent, 'state')
    this.outgoingTypes.set(SyncOutgoingEvent, 'sync')
    this.outgoingTypes.set(GetOutgoingEvent, 'get')
    this.outgoingTypes.forEach((v, k) => this.outgoingActions.set(v, k))
  }
}

export class SyncEvent implements ServerEvent {
  notes: FrozenNote[]
  gone?: string[]
  full?: boolean

  constructor(notes?: FrozenNote[]) {
    this.notes = notes
  }

  got(sync: SyncService) {
    const fetch = new Array<string>()
    this.notes.forEach(n => {
      const needsSync = sync.handleNoteFromServer(n, this.full)
      fetch.push(...needsSync)
    })

    if (this.gone) {
      this.gone.forEach(id => sync.setGone(id))
    }

    sync.syncLocalProps()

    if (fetch.length > 0) {
      sync.send(new GetOutgoingEvent(fetch))
    }
  }
}

export class StateEvent implements ServerEvent {
  notes: Array<[string, string, string]>

  constructor(notes: Array<[string, string, string]>) {
    this.notes = notes
  }

  got(sync: SyncService) {
    const fetch = new Array<string>()
    this.notes.forEach(
      note => {
        const success = sync.setNoteRev(note[0], note[1], note[2])

        if (!success) {
          fetch.push(note[0])
        }
      }
    )

    if (fetch.length > 0) {
      sync.send(new GetOutgoingEvent(fetch))
    }
  }
}

export class IdentifyEvent implements ServerEvent {
  invitation: Invitation

  constructor(invitation: Invitation) {
    this.invitation = invitation
  }

  got(sync: SyncService) {
    sync.sendState()
  }
}

export class InvitationEvent implements ServerEvent {
  reload: boolean

  constructor(reload: boolean) {
    this.reload = reload
  }

  got(sync: SyncService) {
    sync.reloadInvitations()
  }
}

export class GetEvent implements ServerEvent {
  notes: FrozenNote[]

  constructor(notes?: FrozenNote[]) {
    this.notes = notes
  }

  got(sync: SyncService) {
    const fetch = this.notes.flatMap(note => {
      return sync.handleNoteFromServer(note, true)
    })
    if (fetch.length) {
      sync.send(new GetOutgoingEvent(fetch))
    }
  }
}
