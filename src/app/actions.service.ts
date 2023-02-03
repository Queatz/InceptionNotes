import {Injectable} from '@angular/core'
import {ApiService, Note} from './api.service'
import {UiService} from './ui.service'

@Injectable({
  providedIn: 'root'
})
export class ActionsService {

  private actions: Array<Action<any>> = [
    new TrimItemsStartAction(this.api, this.ui),
    new TrimItemsEndAction(this.api, this.ui)
  ]

  constructor(private api: ApiService, private ui: UiService) {
  }

  allActions() {
    return [ ...this.actions ]
  }
}

abstract class TrimItemsAction implements Action<TrimActionParams> {
  abstract name
  abstract description
  abstract run(note: Note, params: TrimActionParams): void

  protected constructor(protected api: ApiService, protected ui: UiService) {
  }

  present(note: Note) {
    this.ui.dialog({
      message: `<b>${this.name}</b>\n\n${this.description}`,
      input: true,
      ok: result => {
        if (result.input) {
          this.run(note, { textToRemove: result.input })
        }
      }
    })
  }
}

class TrimItemsStartAction extends TrimItemsAction {
  name = 'Trim all items (start)'
  description = 'Trim the start of all items in this note. Enter the text to remove.'

  constructor(api: ApiService, ui: UiService) {
    super(api, ui)
  }

  run(note: Note, params: TrimActionParams) {
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

export interface Action<T> {
  name: string
  description: string
  present(note: Note)
  run(note: Note, params: T): void
}


class TrimActionParams {
  textToRemove: string
}
