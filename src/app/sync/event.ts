import {IdentifyOutgoingEvent, StateOutgoingEvent, SyncOutgoingEvent, SyncService} from 'app/sync.service'
import {FrozenNote} from '../api.service'
import {InvitationServerModel} from '../collaboration.service'

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
    this.types.forEach((v, k) => this.actions.set(v, k))
    this.outgoingTypes.set(IdentifyOutgoingEvent, 'identify')
    this.outgoingTypes.set(StateOutgoingEvent, 'state')
    this.outgoingTypes.set(SyncOutgoingEvent, 'sync')
    this.outgoingTypes.forEach((v, k) => this.outgoingActions.set(v, k))
  }
}

export class SyncEvent implements ServerEvent {
  notes: FrozenNote[]

  constructor(notes?: FrozenNote[]) {
    this.notes = notes
  }

  got(sync: SyncService) {
    this.notes.forEach(n => {
      Object.keys(n).forEach(prop => {
        if (prop === 'id') {
          return
        }

        sync.handleUpdateFromServer(n.id, prop, n[prop])
      })
    })
    // todo needs to happen after UI merge conflicts
    sync.syncLocalProps()
  }
}

export class StateEvent implements ServerEvent {
  notes: Array<[string, string]>

  constructor(notes: Array<[string, string]>) {
    this.notes = notes
  }

  got(sync: SyncService) {
    this.notes.forEach(note => {
      sync.setNoteRev(note[0], note[1])
    })
  }
}

export class IdentifyEvent implements ServerEvent {
  invitation: InvitationServerModel

  constructor(invitation: InvitationServerModel) {
    this.invitation = invitation
  }

  got(sync: SyncService) {
    sync.sendState()
  }
}
