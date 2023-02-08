import {Component, HostListener, Input, OnInit} from '@angular/core'

import {ApiService, Note} from '../api.service'
import {UiService} from '../ui.service'

import Util from '../util'

@Component({
  selector: 'sub-sub-list-item',
  templateUrl: './sub-sub-list-item.component.html',
  styleUrls: ['./sub-sub-list-item.component.css'],
  host: {
    '[style.outline]': 'isDroppingList ? \'3px solid orange\' : undefined'
  }
})
export class SubSubListItemComponent implements OnInit {
  @Input() item: Note

  isDroppingList: boolean
  private dragCounter = 0

  constructor(public ui: UiService, private api: ApiService) {
  }

  ngOnInit() {
  }

  @HostListener('dragenter', ['$event'])
  dragOn(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.dragCounter++

    this.isDroppingList = true
  }

  @HostListener('dragleave', ['$event'])
  dragOff(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.dragCounter--

    // This is here to prevent flickering
    if (this.dragCounter < 1) {
      this.isDroppingList = false
    }
  }

  @HostListener('dragover', ['$event'])
  nothing(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
  }

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.isDroppingList = false
    this.dragCounter = 0
    const ids = event.dataTransfer.getData('application/x-ids').split(',')
    ids.sort((aId, bId) => {
      const a = this.api.search(aId)
      const b = this.api.search(bId)
      return a?.parent?.items?.indexOf(a) - b?.parent?.items?.indexOf(b)
    }).forEach(id => {
      this.api.moveList(id, this.item.id)
    })
  }

  isSelectedNav(item: Note) {
    return this.api.contains(this.api.getShow().id, item)
  }

  isExactSelectedNav(item: Note) {
    return item === this.api.getShow()
  }

  visualIndex(item: Note): number {
    return this.item.items.filter(x => !this.hideItem(x, undefined, true)).indexOf(item)
  }

  hideItem(item: Note, includeEmpty = true, internalCall = false) {
    if (this.ui.getEnv().showOnly && (!internalCall && this.visualIndex(item)) >= this.ui.getEnv().showOnly) {
      return true
    }

    return (item.checked && this.ui.getEnv().hideDoneItems)
  }

  getAfterText(item: Note) {
    const c = this.countSubItems(item)
    const d = this.ui.getEnv().showEstimates ? this.api.getSubItemEstimates(item).reduce((acc: number, val: number) => +acc + +val, 0) : 0

    return c || d ? ' (' + (c ? c + ' item' + (c !== 1 ? 's' : '') : '') + (d && c ? ', ' : '') + (d ? d + ' day' + (d !== 1 ? 's' : '') : '') + ')' : ''
  }

  hasSubnavs(item: Note) {
    if (item.items.every(x => this.isEmpty(x))) {
      return false
    } else if (this.ui.getEnv().expandedNav && !this.item.collapsed) {
      return true
    } else if (this.isSelectedNav(this.item)) {
      return true
    }

    return false
  }

  getMaxHeight(e: HTMLElement, item: Note) {
    if (item.items.every(x => this.isEmpty(x))) {
      return undefined
    }if ((this.ui.getEnv().expandedNav && !this.item.collapsed)) {
      return undefined
    } else if (this.isSelectedNav(this.item)) {
      return e.scrollHeight + 'px'
    }

    return '0'
  }

  countSubItems(item: Note) {
    return this.api.getSubItemNames(item).length
  }

  isEmpty(item: Note) {
    return Util.isEmptyStr(item.name)
  }

  openItem(dblclickEvent: Event, subItem: Note) {
    dblclickEvent.stopPropagation()
    this.api.setEye(subItem)

    return false
  }

  showItem(dblclickEvent: Event, subItem: Note) {
    dblclickEvent.stopPropagation()
    this.api.setShow(subItem)

    return false
  }

  scrollToNote(event: MouseEvent, item?: Note) {
    event.stopPropagation()
    this.ui.locate.next({list: item ?? this.item})
  }
}
