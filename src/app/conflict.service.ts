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

  private activeConflict?: Conflict = null

  constructor(private ui: UiService, private api: ApiService) { }

  addConflict(conflict: Conflict) {
    if (!this.conflicts.length && !this.activeConflict) {
      this.presentConflict(conflict)
    } else {
      this.conflicts.push(conflict)
    }
  }

  presentConflict(conflict: Conflict) {
    this.activeConflict = conflict
    this.api.setEye(conflict.note)
    const { note, prop, localProp } = conflict
    this.ui.dialog({
      message: `${note.name}\n\nOverwrite ${prop} "${this.present(note[prop])}" with "${this.present(localProp)}"?`,
      ok: () => {
        // Accept server version
        this.resolutions.next(new ConflictResolution(conflict, true))
        this.resolveNextConflict()
      },
      cancel: () => {
        this.resolutions.next(new ConflictResolution(conflict, false))
        this.resolveNextConflict()
      }
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

  private resolveNextConflict() {
    this.activeConflict = null
    if (this.conflicts.length) {
      this.presentConflict(this.conflicts.shift())
    } else {
      this.conflictsResolved.next()
    }
  }
}
