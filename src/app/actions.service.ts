import {Injectable} from '@angular/core'
import {ApiService, Note} from './api.service'
import {UiService} from './ui.service'
import {DialogModel} from './dialog/dialog.component'

@Injectable({
  providedIn: 'root'
})
export class ActionsService {

  private actions: Array<Action<any>> = [
    new TrimItemsStartAction(this.api, this.ui),
    new TrimItemsEndAction(this.api, this.ui),
    new SplitByLinksAction(this.api, this.ui),
  ]

  constructor(private api: ApiService, private ui: UiService) {
  }

  allActions() {
    return [ ...this.actions ]
  }
}

abstract class DialogAction<T> implements Action<T> {
  abstract name
  abstract description
  abstract input: boolean
  abstract params(result: DialogModel)
  abstract run(note: Note, params: T): void

  protected constructor(protected api: ApiService, protected ui: UiService) {
  }

  present(note: Note) {
    this.ui.dialog({
      message: `<b>${this.name}</b>\n\n${this.description}`,
      input: this.input,
      ok: result => {
        this.run(note, this.params(result))
      }
    })
  }
}

abstract class TrimItemsAction extends DialogAction<TrimActionParams> {

  input = true

  protected constructor(api: ApiService, ui: UiService) {
    super(api, ui)
  }

  params(result: DialogModel) {
    return { textToRemove: result.input }
  }
}

class TrimItemsStartAction extends TrimItemsAction {
  name = 'Trim all items (start)'
  description = 'Trim the start of all items in this note. Enter the text to remove.'

  constructor(api: ApiService, ui: UiService) {
    super(api, ui)
  }

  run(note: Note, params: TrimActionParams) {
    if (!params.textToRemove) {
      return
    }
    let anyNoteChanged = false
    note.items.forEach(item => {
      if (item.name.startsWith(params.textToRemove)) {
        item.name = item.name.slice(params.textToRemove.length)
        this.api.modified(item, 'name')
        anyNoteChanged = true
      }
    })

    if (!anyNoteChanged) {
      this.ui.dialog({
        message: 'No items were trimmed'
      })
    }
  }
}

class TrimItemsEndAction extends TrimItemsAction {
  name = 'Trim all items (end)'
  description = 'Trim the end of all items in this note. Enter the text to remove.'

  constructor(api: ApiService, ui: UiService) {
    super(api, ui)
  }

  run(note: Note, params: TrimActionParams) {
    if (!params.textToRemove) {
      return
    }
    let anyNoteChanged = false
    note.items.forEach(item => {
      if (item.name.endsWith(params.textToRemove)) {
        item.name = item.name.slice(0, -params.textToRemove.length)
        this.api.modified(item, 'name')
        anyNoteChanged = true
      }
    })

    if (!anyNoteChanged) {
      this.ui.dialog({
        message: 'No items were trimmed'
      })
    }
  }
}

class SplitByLinksAction extends DialogAction<any> {
  name = 'Split by links'
  description = 'Splits the note into separate items based on item links.'
  input = false

  constructor(api: ApiService, ui: UiService) {
    super(api, ui)
  }

  params(result: DialogModel) {
  }

  run(note: Note, params: any) {
    const groups = new Map<string, { name: string, ref: Array<Note>, items: Array<Note> }>()
    note.items.forEach(
      item => {
        const group = item.ref?.map(x => x.id)?.join(':') || ''
        if (!groups.has(group)) {
          groups.set(group, { name: item.ref?.map(x => x.name)?.join(', ') || 'No links', ref: item.ref, items: [] })
        }
        groups.get(group).items.push(item)
      }
    )

    groups.forEach(group => {
      const groupNote = this.api.newBlankList(note)
      groupNote.name = group.name
      this.api.modified(groupNote, 'name')
      group.ref.forEach(ref => {
        this.api.addRef(groupNote, ref)
      })
      group.items.forEach(item => {
        this.api.moveList(item.id, groupNote.id)
        new Array(...(item.ref || [])).forEach(ref => {
          this.api.removeRef(item, ref)
        })
      })
    })
  }
}

export interface Action<T> {
  name: string
  description: string
  present(note: Note)
  run(note: Note, params: T): void
}


class TrimActionParams {
  textToRemove: string
}
