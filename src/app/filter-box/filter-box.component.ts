import { Component } from '@angular/core'
import {UiService} from '../ui.service'
import {FilterService} from '../filter.service'
import {Note} from '../api.service'
import Util from '../util'

@Component({
  selector: 'app-filter-box',
  templateUrl: './filter-box.component.html',
  styleUrls: ['./filter-box.component.css'],
  host: {
   '[class.is-showing]': 'filter.byRef?.length',
   '[class.dark-theme]': 'ui.getEnv().useDarkTheme',
   '[class.flat-theme]': 'ui.getEnv().showFlat',
  }
})
export class FilterBoxComponent {
  constructor(public ui: UiService, public filter: FilterService) {
  }


  getItemLinkText(item: Note) {
    let t = ''
    let p = item.parent

    for (let i = 0; i < 3 && p; i++) {
      t += ' → ' + p.name
      p = p.parent
    }

    return Util.htmlToText(t, true)
  }

  removeFilter(event: Event, item: Note) {
    event.stopPropagation()
    this.filter.toggleRef(item)

    return false
  }

  showFilterOptions(event: MouseEvent, item: Note) {
    event.preventDefault()
    event.stopPropagation()

    this.ui.menu([
      {
        title: 'Remove filter',
        callback: () => this.filter.toggleRef(item)
      }
    ], {x: event.clientX, y: event.clientY})
  }
}
