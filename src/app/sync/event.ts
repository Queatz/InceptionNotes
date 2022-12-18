import {SyncService} from 'app/sync.service'
import {FrozenNote} from '../api.service'

export interface ServerEvent {
  got(sync: SyncService): void
}

export class Event {
  types: Map<any, string> = new Map()
  actions: Map<string, any> = new Map()

  constructor() {
    this.types.set(SyncEvent, 'sync')
    this.types.set(IdentifyEvent, 'identify')
    this.types.set(BasicMessageEvent, 'message')
    this.types.set(ShowEvent, 'show')
    this.types.set(ServerRequestEvent, 'server')

    this.types.forEach((v, k) => this.actions.set(v, k))
  }
}

export class SyncEvent implements ServerEvent {
  notes: FrozenNote[]

  constructor(notes?: FrozenNote[]) {
    this.notes = notes
  }

  public got(sync: SyncService) {
    this.notes.forEach(n => {
      Object.keys(n).forEach(prop => {
        if (prop === 'id') {
          return
        }

        if (prop === 'sync') {
          n[prop].forEach(p => {
            sync.setSynced(n.id, p)
          })
          return
        }

        sync.handleUpdateFromServer(n.id, prop, n[prop])
      })
    })
  }
}

export class IdentifyEvent {
  client: string
  me: string

  constructor(client: string, me: string) {
    this.client = client
    this.me = me
  }
}

export class ShowEvent {
  show: string

  constructor(show: string) {
    this.show = show
  }
}

export class BasicMessageEvent implements ServerEvent {
  message: string

  public got(sync: SyncService) {
    window.alert(this.message)
  }
}

export class ServerRequestEvent implements ServerEvent {
  name: string

  constructor(name: string) {
    this.name = name
  }

  public got(sync: SyncService) {
    switch (this.name) {
      case 'fetch':
        sync.fetch()
        break
      case 'identify':
        sync.identified()
        break
    }
  }
}
