import { Component, ElementRef, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges, HostListener, HostBinding, ViewChild } from '@angular/core';

import Util from '../util';
import { ApiService } from '../api.service';
import { UiService } from '../ui.service';
import { ColorPickerComponent } from '../color-picker/color-picker.component';
import { SearchComponent } from '../search/search.component';
import { VillageService } from 'app/village.service';

@Component({
  selector: 'sub-list',
  templateUrl: './sub-list.component.html',
  styleUrls: ['./sub-list.component.css'],
  host: {
    '[style.background-color]': 'useAsNavigation ? transparent : list.color',
    '[style.opacity]': 'isDraggingList ? \'0.5\' : undefined',
    '[style.cursor]': 'useAsNavigation ? \'default\' : undefined',
    '[style.max-width]': 'getEnv().showAsPriorityList ? \'32rem\' : undefined',
    '[style.width]': 'getEnv().showAsPriorityList ? \'100%\' : undefined'
  }
})
export class SubListComponent implements OnInit, OnChanges {

	@Input() list: any;
	@Input() useAsNavigation: any;
	@Output('modified') modified = new EventEmitter();
  @Output('removed') removed = new EventEmitter();
  
  @ViewChild('element') nameElement: ElementRef;
  @ViewChild('items') itemsElement: ElementRef;

  private isDraggingList: boolean;
  private isDroppingList: boolean;
  public dropAt: string;
  private isTouch: boolean;
  private dragCounter: number = 0;

  constructor(private ui: UiService, private api: ApiService, private elementRef: ElementRef, private village: VillageService) { }

  ngOnInit() {
    this.initNext();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.initNext();
  }

  @HostListener('contextmenu', ['$event'])
  showOptions(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    let menu = {
      options: this.village.me() ? [
        'Link...',
        'Move...',
        'Add people...',
        'Change color...',
        this.list.collapsed ? 'Un-collapse' : 'Collapse'
      ] : [
        'Link...',
        'Move...',
        'Change color...',
        this.list.collapsed ? 'Un-collapse' : 'Collapse'
      ],
      actions: this.village.me() ? [
        () => this.addToNote(this.list),
        () => this.moveToNote(this.list),
        () => this.addPeople(this.list),
        () => this.changeColor(),
        () => this.toggleCollapse()
      ] : [
        () => this.addToNote(this.list),
        () => this.moveToNote(this.list),
        () => this.changeColor(),
        () => this.toggleCollapse()
      ]
    };

    this.ui.menu(menu.options, { x: event.clientX, y: event.clientY }, choice => menu.actions[choice]());
  }

  addPeople(list: any) {
    this.ui.dialog({
      message: 'Add people',
      input: true,
    });
  }

  showSubitemOptions(event: MouseEvent, item: any) {
    event.preventDefault();
    event.stopPropagation();

    this.ui.menu([
      'Link...',
      'Move...',
      'Estimate...',
    ], { x: event.clientX, y: event.clientY },
    choose => {
      switch (choose) {
        case 0:
          this.addToNote(item);
          break;
        case 1:
          this.moveToNote(item);
          break;
        case 2:
          this.ui.dialog({
            message: 'Estimate (in days)',
            prefill: item.estimate,
            input: true,
            ok: r => {
              item.estimate = Number(r.input);
              this.api.modified(item, 'estimate');
            }
          });
          break;
      }
    });
  }

  showRefOptions(event: MouseEvent, item: any, refItem: any) {
    event.preventDefault();
    event.stopPropagation();

    this.ui.menu([
      'Unlink',
    ], { x: event.clientX, y: event.clientY },
    choose => {
      switch (choose) {
        case 0:
          this.api.removeRef(item, refItem);
          break;
      }
    });
  }

  private toggleCollapse() {
    this.list.collapsed = !this.list.collapsed;
    this.api.modified(this.list, 'collapsed');
  }

  private addToNote(item: any) {
    this.ui.dialog({
          message: 'Link',
          input: true,
          view: SearchComponent,
          init: dialog => {
              dialog.changes.subscribe(val => {
                  dialog.component.instance.searchString = val;
                  dialog.component.instance.ngOnChanges(null);
              });
              dialog.component.instance.onSelection.subscribe(note => {
                  this.api.addRef(item, note);
                  if (!this.getEnv().showLinks) {
                    this.getEnv().showLinks = true;
                    setTimeout(() => this.ui.dialog({ message: 'Show links enabled' }));
                  }
                  dialog.back();
              });
              dialog.component.instance.resultsChanged.subscribe(results => {
                  dialog.model.results = results;
              });
          },
          ok: result => {
              if (result.results && result.results.length) {
                  this.api.addRef(item, result.results[0]);
                  if (!this.getEnv().showLinks) {
                    this.getEnv().showLinks = true;
                    setTimeout(() => this.ui.dialog({ message: 'Show links enabled' }));
                  }
              }
          }
        });
  }

  private moveToNote(item: any) {
    this.ui.dialog({
          message: 'Move...',
          input: true,
          view: SearchComponent,
          init: dialog => {
              dialog.changes.subscribe(val => {
                  dialog.component.instance.searchString = val;
                  dialog.component.instance.ngOnChanges(null);
              });
              dialog.component.instance.onSelection.subscribe(note => {
                  this.api.moveList(item.id, note.id);
                  dialog.back();
              });
              dialog.component.instance.resultsChanged.subscribe(results => {
                  dialog.model.results = results;
              });
          },
          ok: result => {
              if (result.results && result.results.length) {
                  this.api.moveList(item.id, result.results[0].id);
              }
          }
        });
  }

  private changeColor() {
    this.ui.dialog({
      message: 'Change color',
      input: true,
      prefill: this.list.color,
      view: ColorPickerComponent,
      init: dialog => {
        dialog.component.instance.onColorSelected.subscribe(color => dialog.model.input = color);
        dialog.component.instance.onColorConfirmed.subscribe(color => dialog.clickOk());
      },
      ok: result => {
        if (result.input) {
          this.list.color = result.input;
          this.ui.addRecentColor(result.input);
          this.api.modified(this.list, 'color');
        }
      }
    });
  }

  @HostListener('touchstart', ['$event'])
  setIsTouch() {
    this.isTouch = true;
  }

  @HostBinding('style.outline')
  get styleOutline() {
    return !this.dropAt && this.isDroppingList ? '3px solid orange' : undefined;
  }

  @HostBinding('draggable')
  get draggable() {
    return !this.useAsNavigation && !this.isTouch;
  }

  @HostListener('dragstart', ['$event'])
  startDrag(event: DragEvent) {
    if (this.useAsNavigation) {
      return;
    }

    event.stopPropagation();

    this.isDraggingList = true;
    event.dataTransfer.setData('application/x-id', this.list.id);
  }

  @HostListener('dragend', ['$event'])
  stopDrag(event: DragEvent) {
    if (this.useAsNavigation) {
      return;
    }

    event.stopPropagation();

    this.isDraggingList = false;
  }

  @HostListener('dragenter', ['$event'])
  dragOn(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.dragCounter++;

    if (!this.isDraggingList) {
      this.isDroppingList = true;
    }

    this.setDropAt(event);
  }

  @HostListener('dragleave', ['$event'])
  dragOff(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.dragCounter--;

    // This is here to prevent flickering
    if (this.dragCounter < 1) {
      this.isDroppingList = false;
      this.dropAt = null;
    }
  }

  @HostListener('dragover', ['$event'])
  nothing(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.setDropAt(event);
  };

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    let id = event.dataTransfer.getData('application/x-id');

    if (id) {
      if (!this.dropAt) {
        this.api.moveList(id, this.list.id);
      } else if (this.dropAt === 'left') {
        if (this.list.parent) {
          this.api.moveListToPosition(id, this.list.parent.id, this.list.parent.items.indexOf(this.list));
        }
      } else if (this.dropAt === 'right') {
        if (this.list.parent) {
          this.api.moveListToPosition(id, this.list.parent.id, this.list.parent.items.indexOf(this.list) + 1);
        }
      }
    } else {
      let text = event.dataTransfer.getData('text/plain');

      if (text) {
        let l = this.newBlankList();
        l.transient = false;
        l.name = text;
        this.api.modified(l);
      }
    }

    this.isDroppingList = false;
    this.dropAt = null;
    this.dragCounter = 0;
  }

  setDropAt(event: DragEvent) {
    if (this.isDraggingList) {
      return;
    }

    let element = this.elementRef.nativeElement;

    if (!element.getBoundingClientRect) {
      return;
    }

    let rect = element.getBoundingClientRect();
    let percent = Math.max(0, Math.min(element.clientWidth, event.clientX - rect.left) / element.clientWidth);

    if (percent < .25) {
      this.dropAt = 'left';
    } else if (percent < .75) {
      this.dropAt = null;
    } else {
      this.dropAt = 'right';
    }
  }

  isSelectedNav(item: any) {
    return this.api.contains(item.id, this.api.getShow());
  }

  openList(dblclickEvent: Event) {
    dblclickEvent.stopPropagation();
    if (this.list.transient) {
      return;
    }

    this.api.setEye(this.list);

    return false;
  }

  openItem(dblclickEvent: Event, item: any) {
    dblclickEvent.stopPropagation();
    if (this.list.transient) {
      return;
    }

    this.api.setEye(item);

    return false;
  }

  showItem(dblclickEvent: Event, item: any) {
    dblclickEvent.stopPropagation();
    if (this.list.transient) {
      return;
    }

    this.api.setShow(item);

    return false;
  }

  onNameChange() {
    this.api.modified(this.list, 'name');

    if (this.list.name) {
      this.modified.emit(this.list);
    }
  }

  private isEmptyName(name: string) {
    return !name.replace(/<(?:.|\n)*?>/gm, '').trim();
  }

  getSubitemText(item: any) {
    let c = this.countSubItems(item);

    return c ? c + ' sub-item' + (c === 1 ? '' : 's') : 'No sub-items';
  }

  getItemLinkText(item: any) {
    let t = '';
    let p = item.parent;

    for(let i = 0; i < 3 && p; i++) {
      t += ' → ' + p.name;
      p = p.parent;
    }

    return Util.htmlToText(t);
  }

  getAfterText(item: any) {
    let c = this.countSubItems(item);
    let d = this.getEnv().showEstimates ? this.api.getSubItemEstimates(item).reduce((acc: number, val: number) => +acc + +val, 0) : 0;

    return c || d ? ' (' + (c ? c + ' item' + (c !== 1 ? 's' : '') : '') + (d && c ? ', ' : '') + (d ? d + ' day' + (d !== 1 ? 's' : '') : '') + ')' : null;
  }

  getBeforeText(item: any) {
    return  '•';
  }

  onNameBackspacePressed() {
    if (this.isEmptyName(this.list.name)) {
      this.removed.emit();
    }
  }

  onNameEnterPressed(element: any) {
    this.newBlankList(0);

    setTimeout(() => {
      let n = element.parentNode.nextElementSibling.children[0].children[0].children[0];
      if (n && n.focus) {
        n.focus();
      }
    });

    return false;
  }

  onItemChange(item: any) {
    this.api.modified(item, 'name');

    if (item.transient && item.name) {
      item.transient = undefined;
      this.initNext();
      this.modified.emit(item);
    }
  }

  moveItem(event: Event, item: any, move: number) {
    event.stopPropagation();
    event.preventDefault();
    
    let location = this.list.items.indexOf(item);

    if (location === -1) {
      return;
    }

    if (move < 0 && location === 0) {
      return;
    }

    if (move > 0 && location === this.list.items.length - 1) {
      if (this.list.parent) {
        let pos = this.list.parent.items.indexOf(this.list);

        if (pos >= 0 && pos <= this.list.parent.items.length - 1) {
          this.api.moveListUp(item, pos + 1);
          return;
        }
      }

      this.api.moveListUp(item);
    }

    this.list.items.splice(location, 1);
    this.list.items.splice(location + move, 0, item);
    this.api.modified(this.list, 'items');

    setTimeout(() => this.elementRef.nativeElement.querySelectorAll('.sub-list-item')[(location + move)].focus());
  }

  onItemEnterPressed(element: any, item: any) {
    let n = element.parentNode.parentNode.nextSibling;

    if (n && n.children && n.children.length) {
      n = n.children[0].children[0];
    }

    if (n && n.focus) {
      let i = this.list.items.indexOf(item);

      if (i !== -1) {
        this.newBlankList(i + 1);
        setTimeout(() => element.parentNode && element.parentNode.parentNode.nextSibling && element.parentNode.parentNode.nextSibling.children[0] && element.parentNode.parentNode.nextSibling.children[0].children[0] && element.parentNode.parentNode.nextSibling.children[0].children[0].focus());
      } else {
        n.children[0].focus();
      }
    } else {
      item.transient = false;
      this.initNext();
      setTimeout(() => element.parentNode && element.parentNode.parentNode.nextSibling && element.parentNode.parentNode.nextSibling.children[0] && element.parentNode.parentNode.nextSibling.children[0].children[0] && element.parentNode.parentNode.nextSibling.children[0].children[0].focus());
    }

    return false;
  }

  onItemBackspacePressed(element: any, item: any) {
    if (this.isEmptyName(item.name) && this.list.items.length > 1) {
      let c = this.api.getSubItemNames(item);

      if (c.length) {
        this.ui.dialog({
          message: 'Also delete ' + c.length + ' sub-item' + (c.length === 1 ? '' : 's') + '?\n\n' + c.join('\n'),
          ok: () => {
            this.deleteItem(element, item);
          }
        });
      } else {
        this.deleteItem(element, item);
      }
    }
  }

  countSubItems(item: any) {
    return this.api.getSubItemNames(item).length;
  }

  getEnv() {
    return this.ui.getEnv();
  }

  @HostListener('click', ['$event'])
  @HostListener('dblclick', ['$event'])
  dontPropagate(event: Event) {
    event.stopPropagation();
  }

  public onArrowUpDown(event: Event, item: any, move: number) {
    event.preventDefault();

    if (move === 1) {
      let e = (event.target as any).parentNode.parentNode.nextElementSibling;

      if (e && e.children[0].children[0] && e.children[0].focus) {
        e.children[0].children[0].focus();
        event.preventDefault();
      }
    } else if (move === -1) {
      let e = (event.target as any).parentNode.parentNode.previousElementSibling;

      event.preventDefault();

      if (e && e.children[0].children[0] && e.children[0].focus) {
        e.children[0].children[0].focus();
      } else {
        this.focusName();
      }
    }
  }
  
  private focusName() {
    this.nameElement.nativeElement.focus();
  }

  public focusItem(index: number) {
    this.itemsElement
        .nativeElement
        .children[index]
        .querySelector('[contenteditable]')
        .focus();
  }

  private deleteItem(element: any, item: any) {
    this.list.items.splice(this.list.items.indexOf(item), 1);
    this.api.modified(this.list, 'items');

    let e = element.parentNode.parentNode.previousElementSibling;

    if (e && e.children[0].children[0] && e.children[0].focus) {
      e.children[0].children[0].focus();
    }
  }

  private initNext() {
    // Heal notes without ids
    if (!this.list.id) {
      this.list.id = this.api.newId();
    }

    if (this.useAsNavigation) {
      return;
    }

    if (this.list.items.length && this.list.items[this.list.items.length - 1].transient) {
      return;
    }

    this.newBlankList();
  }

  private newBlankList(position: number = null) {
    let l = this.api.newBlankList(this.list, position);
    l.color = this.list.color;
    return l;
  }
}
