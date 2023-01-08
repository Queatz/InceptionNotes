import { Injectable } from '@angular/core'
import {ApiService, Note} from './api.service'
import {UiService} from './ui.service'
import {Subject} from 'rxjs'

export class Conflict {
  constructor(
    public note: Note,
    public prop: string,
    public localProp: any,
    public serverRev: string
  ) {
  }
}

export class ConflictResolution {
  constructor(
    public conflict: Conflict,
    public accept: boolean
  ) {
  }
}

@Injectable({
  providedIn: 'root'
})
export class ConflictService {

  readonly conflicts = new Array<Conflict>()
  readonly resolutions = new Subject<ConflictResolution>()
  readonly conflictsResolved = new Subject<void>()

  private previousEye?: Note = null
  private previousSidePanel?: boolean = null
  private activeConflict?: Conflict = null

  constructor(private ui: UiService, private api: ApiService) { }

  addConflict(conflict: Conflict) {
    if (!this.conflicts.length && !this.activeConflict) {
      this.presentConflict(conflict)
    } else {
      if (this.activeConflict.note === conflict.note && this.activeConflict.prop === conflict.prop) {
        return
      }
      const index = this.conflicts.findIndex(x => x.note === conflict.note && x.prop === conflict.prop)
      if (index !== -1) {
        this.conflicts.splice(index, 1)
      }
      this.conflicts.push(conflict)
    }
  }

  presentConflict(conflict: Conflict) {
    if (!this.previousEye) {
      this.previousEye = this.api.getEye()
      this.previousSidePanel = this.ui.getEnv().sidepane
    }
    this.api.setEye(conflict.note)
    this.activeConflict = conflict
    const { note, prop, localProp } = conflict
    this.ui.dialog({
      message: `Replace note ${prop}?\n\nLocal\n<b>${this.present(note[prop])}</b>\n\nRemote\n<b>${this.present(localProp)}</b>`,
      cancel: () => {
        this.resolveNextConflict()
      },
      buttons: [
        ['No, overwrite remote with local', () => {
          this.resolutions.next(new ConflictResolution(conflict, false))
          this.resolveNextConflict()
        }],
        ['Yes, overwrite local with remote', () => {
          this.resolutions.next(new ConflictResolution(conflict, true))
          this.resolveNextConflict()
        }]
      ]
    })
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

  hasConflicts(): boolean {
    return !!this.activeConflict || !!this.conflicts.length
  }

  setNoteServerRev(id: string, serverRev: string) {
    if (this.activeConflict && this.activeConflict.note.id === id) {
      this.activeConflict.serverRev = serverRev
    }

    this.conflicts.forEach(conflict => {
      if (conflict.note.id === id) {
        conflict.serverRev = serverRev
      }
    })
  }

  private resolveNextConflict() {
    this.activeConflict = null
    if (this.conflicts.length) {
      this.presentConflict(this.conflicts.shift())
    } else {
      if (this.previousEye) {
        this.api.setEye(this.previousEye)
        this.ui.getEnv().sidepane = this.previousSidePanel
        this.previousEye = null
        this.previousSidePanel = null
      }
      this.conflictsResolved.next()
    }
  }
}
