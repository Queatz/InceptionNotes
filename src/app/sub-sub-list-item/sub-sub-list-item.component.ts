import {Component, OnInit, Input, HostListener} from '@angular/core';

import {ApiService} from '../api.service';
import {UiService} from '../ui.service';

import Util from '../util';
import {FilterService} from '../filter.service';

@Component({
  selector: 'sub-sub-list-item',
  templateUrl: './sub-sub-list-item.component.html',
  styleUrls: ['./sub-sub-list-item.component.css'],
  host: {
    '[style.outline]': 'isDroppingList ? \'3px solid orange\' : undefined'
  }
})
export class SubSubListItemComponent implements OnInit {
  @Input() item: any;

  isDroppingList: boolean;
  private dragCounter = 0;

  constructor(public ui: UiService, private api: ApiService, private filter: FilterService) {
  }

  ngOnInit() {
  }

  @HostListener('dragenter', ['$event'])
  dragOn(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.dragCounter++;

    this.isDroppingList = true;
  }

  @HostListener('dragleave', ['$event'])
  dragOff(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.dragCounter--;

    // This is here to prevent flickering
    if (this.dragCounter < 1) {
      this.isDroppingList = false;
    }
  }

  @HostListener('dragover', ['$event'])
  nothing(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  };

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.isDroppingList = false;
    this.dragCounter = 0;
    const id = event.dataTransfer.getData('application/x-id');
    this.api.moveList(id, this.item.id);
  }

  isSelectedNav(item: any) {
    return this.api.contains(this.api.getShow().id, item);
  }

  isExactSelectedNav(item: any) {
    return item === this.api.getShow();
  }

  visualIndex(item: any): number {
    return this.item.items.filter(x => !this.hideItem(x, undefined, true)).indexOf(item);
  }

  hideItem(item: any, includeEmpty = true, internalCall = false) {
    if (this.ui.getEnv().showOnly && (!internalCall && this.visualIndex(item)) >= this.ui.getEnv().showOnly) {
      return true;
    }

    return (item.checked && this.ui.getEnv().hideDoneItems);
  }

  getAfterText(item: any) {
    const c = this.countSubItems(item);
    const d = this.ui.getEnv().showEstimates ? this.api.getSubItemEstimates(item).reduce((acc: number, val: number) => +acc + +val, 0) : 0;

    return c || d ? ' (' + (c ? c + ' item' + (c !== 1 ? 's' : '') : '') + (d && c ? ', ' : '') + (d ? d + ' day' + (d !== 1 ? 's' : '') : '') + ')' : '';
  }

  getMaxHeight(e: HTMLElement) {
    if (this.ui.getEnv().expandedNav && !this.item.collapsed) {
      return undefined;
    } else if (this.isSelectedNav(this.item)) {
      return e.scrollHeight + 'px';
    }

    return '0px';
  }

  countSubItems(item: any) {
    return this.api.getSubItemNames(item).length;
  }

  isEmpty(item: any) {
    return Util.isEmptyStr(item.name);
  }

  openItem(dblclickEvent: Event, subItem: any) {
    dblclickEvent.stopPropagation();
    this.api.setEye(subItem);

    return false;
  }

  showItem(dblclickEvent: Event, subItem: any) {
    dblclickEvent.stopPropagation();
    this.api.setShow(subItem);

    return false;
  }

  scrollToNote(event: MouseEvent, item?: any) {
    event.stopPropagation()
    this.ui.locate.next({ list: item ?? this.item })
  }
}
