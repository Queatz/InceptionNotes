import { Component, ElementRef, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges, HostListener, HostBinding, ViewChild } from '@angular/core';

import Util from '../util';
import { ApiService } from '../api.service';
import { UiService, MenuOption } from '../ui.service';
import { ColorPickerComponent } from '../color-picker/color-picker.component';
import { SearchComponent } from '../search/search.component';
import { VillageService } from 'app/village.service';
import { AddPeopleComponent } from 'app/add-people/add-people.component';
import { Config } from 'app/config.service';
import { FilterService } from 'app/filter.service'

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
  
  @ViewChild('element', { static: true }) nameElement: ElementRef;
  @ViewChild('items', { static: false }) itemsElement: ElementRef;

  private isDraggingList: boolean;
  private isDroppingList: boolean;
  public dropAt: string;
  private isTouch: boolean;
  private dragCounter: number = 0;
  private mouseDownHack: boolean;

  constructor(private ui: UiService, private api: ApiService, private filter: FilterService, private elementRef: ElementRef, private village: VillageService, private config: Config) { }

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

    let options: Array<MenuOption> = [
      {
        title: 'Link...',
        callback: () => this.addToNote(this.list),
        menu: this.getRecentsSubmenu(recent => { this.api.addRecent('search', recent.id); this.api.addRef(this.list, recent); }, this.list) 
      },
      ...(this.list.parent ? [ {
          title: 'Move...',
          callback: () => this.moveToNote(this.list),
          menu: this.getRecentsSubmenu(recent => { this.api.addRecent('search', recent.id); this.api.moveList(this.list.id, recent.id); }, this.list)
        }, {
        title: 'Duplicate',
        callback: () => this.api.duplicateList(this.list)
      } ] : []),
      {
        title: 'Sort',
        shortcut: '⯈',
        callback: () => {},
        menu: [
          {
            title: 'By links',
            shortcut: '⯈',
            callback: () => {},
            menu: [
              ...(this.list.items as Array<any>)
                  .map(item => item.ref || [])
                  .flat()
                  .map(ref => ref.parent)
                  .filter(list => !!list)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map(refParent => {
                return {
                  title: refParent.name,
                  callback: () => {
                    this.list.items.sort((a: any, b: any) => {
                      const aRef = a.ref?.find(ref => ref.parent === refParent);
                      const bRef = b.ref?.find(ref => ref.parent === refParent);

                      // Notes without refs to the refParent don't get sorted
                      if (!aRef && !bRef) {
                        return 0;
                      }

                      // Notes without refs to the refParent get moved down
                      if (!aRef !== !bRef) {
                        return !aRef ? 1 : -1;
                      }

                      const aPos = refParent.items.indexOf(aRef);
                      const bPos = refParent.items.indexOf(bRef);

                      return aPos === bPos ? 0 : aPos > bPos ? 1 : -1;
                    });
                    this.api.modified(this.list, 'items');
                  }
                };
              })
            ]
          },
          {
            title: 'Done to bottom',
            callback: () => {
              this.list.items.sort((a: any, b: any) => { 
                if (!a.name !== !b.name) {
                  return !a.name ? 1 : -1;
                }

                return a.checked === b.checked ? 0 : a.checked ? 1 : -1;
               });
              this.api.modified(this.list, 'items');
            }
          }
        ]
      },
      ...(this.village.me() ? [ {
        title: 'Add people...',
        callback: () => this.addPeople(this.list),
      }] : []),
      {
        title: 'Change color...',
        callback: () => this.changeColor(),
      },
      ...(this.list.parent ? [ {
        title: this.list.collapsed ? 'Un-collapse' : 'Collapse',
        callback: () => this.toggleCollapse(),
      } ] : [])
    ];

    this.ui.menu(options, { x: event.clientX, y: event.clientY });
  }

  addPeople(list: any) {
    this.ui.dialog({
      message: 'Add people',
      input: true,
      view: AddPeopleComponent,
      init: dialog => {
        dialog.changes.subscribe(input => {
          (<AddPeopleComponent>dialog.component.instance).search(input);
        });

        (<AddPeopleComponent>dialog.component.instance).onSelection.subscribe(person => {
          dialog.back();
          this.api.addPersonToNote(this.list, person);
        });
      }
    });
  }

  villageUrl(person: any) {
    return this.config.vlllageUrl() + person.googleUrl;
  }

  showSubitemOptions(event: MouseEvent, item: any) {
    event.preventDefault();
    event.stopPropagation();

    this.ui.menu([
      { title: 'Link...', callback: () => this.addToNote(item), menu: this.getRecentsSubmenu(recent => { this.api.addRecent('search', recent.id); this.api.addRef(item, recent); }, item) },
      { title: 'Move...', callback: () => this.moveToNote(item), menu: this.getRecentsSubmenu(recent => { this.api.addRecent('search', recent.id); this.api.moveList(item.id, recent.id); }, item) },
      ...(this.ui.getEnv().showEstimates ? [ { title: 'Estimate...', callback: () => this.ui.dialog({
        message: 'Estimate (in days)',
        prefill: item.estimate,
        input: true,
        ok: r => {
          item.estimate = Number(r.input);
          this.api.modified(item, 'estimate');
        }
      }) }, ] : []),
      { title: 'Delete', callback: () => this.api.removeListFromParent(item) },
    ], { x: event.clientX, y: event.clientY });
  }

  showRefOptions(event: MouseEvent, item: any, refItem: any) {
    event.preventDefault();
    event.stopPropagation();

    this.ui.menu([
      {
        title: 'Unlink',
        callback: () => this.api.removeRef(item, refItem)
      },
      {
        title: 'Order',
        shortcut: '⯈',
        callback: () => {},
        menu: [
          {
            title: 'First',
            callback: () => this.api.orderRef(item, refItem, 0)
          }, {
            title: 'Last',
            callback: () => this.api.orderRef(item, refItem, -1)
          },
        ]
      }
    ], { x: event.clientX, y: event.clientY });
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
                  this.api.addRecent('search', result.results[0].id);
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
                  dialog.back();
                  this.api.moveList(item.id, note.id);
              });
              dialog.component.instance.resultsChanged.subscribe(results => {
                  dialog.model.results = results;
              });
          },
          ok: result => {
              if (result.results && result.results.length) {
                  this.api.addRecent('search', result.results[0].id);
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
    return this.mouseDownHack && !this.useAsNavigation && !this.isTouch;
  }

  // Hack for Firefox and Safari
  @HostListener('mousedown', ['$event'])
  mouseDownDraggable(event: Event) {
    if (event.target === this.elementRef.nativeElement) {
      this.mouseDownHack = true;
    }
  }

  // Hack for Firefox and Safari
  @HostListener('mouseup', ['$event'])
  mouseUpDraggable(event: Event) {
    this.mouseDownHack = false;
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

  openList(dblclickEvent: Event) {
    dblclickEvent.stopPropagation();
    this.api.setEye(this.list);

    return false;
  }

  openItem(dblclickEvent: Event, item: any) {
    dblclickEvent.stopPropagation();
    this.api.setEye(item);

    return false;
  }

  showItem(dblclickEvent: Event, item: any) {
    dblclickEvent.stopPropagation();
    this.api.setShow(item);

    return false;
  }

  onNameChange() {
    this.api.modified(this.list, 'name');

    if (this.list.name) {
      this.modified.emit(this.list);
    }
  }

  onItemChecked(item: any) {
    item.checked = !item.checked;
    this.api.modified(item, 'checked');    
  }

  isEmpty(item: any) {
    return Util.isEmptyStr(item.name);
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

  getAfterText(item: any, ignoreShowSublistPreviews = false) {
    let c = ignoreShowSublistPreviews || !this.getEnv().showSublistPreviews ? this.countSubItems(item) : 0;
    let d = this.getEnv().showEstimates ? this.api.getSubItemEstimates(item).reduce((acc: number, val: number) => +acc + +val, 0) : 0;

    return c || d ? ' (' + (c ? c + ' item' + (c !== 1 ? 's' : '') : '') + (d && c ? ', ' : '') + (d ? d + ' day' + (d !== 1 ? 's' : '') : '') + ')' : '';
  }

  onNameBackspacePressed() {
    if (Util.isEmptyStr(this.list.name)) {
      this.removed.emit();
    }
  }

  onNameEnterPressed(element: any) {
    this.newBlankList(0);

    setTimeout(() => {
      this.focusItem(0);
    });

    return false;
  }

  onItemChange(item: any) {
    this.api.modified(item, 'name');

    if (item.name) {
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
    } else {
      this.list.items.splice(location, 1);
      this.list.items.splice(location + move, 0, item);
      this.api.modified(this.list, 'items');
    }

    setTimeout(() => this.focusItem(location + move));
  }

  onItemEnterPressed(element: any, item: any) {
    let i = this.list.items.indexOf(item);

    if (i === -1) {
      return false;
    }

    this.newBlankList(i + 1);
    setTimeout(() => this.focusItem(i + 1));

    return false;
  }

  onItemBackspacePressed(element: any, item: any) {
    if (Util.isEmptyStr(item.name) && this.list.items.length > 1) {
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

  hideItem(item: any, includeEmpty = true) {
    return this.filter.byRef?.length && (item.name || includeEmpty) && !item.ref?.find(x => this.filter.byRef.indexOf(x) !== -1);
  }

  numberHidden(list: any) {
    if (this.filter.byRef?.length < 1) {
      return 0;
    }

    return list.items.filter(x => this.hideItem(x, false)).length;
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

    let i = this.list.items.indexOf(item);

    if (i === -1) {
      return;
    }

    if (!this.focusItem(i + move)) {
      this.focusName();
    }
  }
  
  private focusName() {
    this.nameElement.nativeElement.focus();
  }

  public focusItem(index: number) {
    if (index < 0 || index >= this.list.items.length) {
      return false;
    }

    this.itemsElement
        .nativeElement
        .children[index]
        .querySelector('[contenteditable]')
        .focus();

    return true;
  }

  private getRecentsSubmenu(callback: (recent: any) => void, exclude: any): Array<MenuOption> | null {
    const recents = this.api.getRecent('search');

    return recents.length ? recents.filter(x => x !== exclude).map(recent => {
      return {
        title: Util.htmlToText(recent.name) + (recent.parent ? `<span class="note-parent"> → ${ Util.htmlToText(recent.parent.name) }</span>` : ''),
        callback: () => {
          callback(recent);
        }
      } as MenuOption;
    }) : null;
  }

  private deleteItem(element: any, item: any) {
    let i = this.list.items.indexOf(item);
    this.list.items.splice(i, 1);
    this.api.modified(this.list, 'items');

    if (i === 0) {
      this.focusName();
    } else {
      this.focusItem(i - 1);
    }
  }

  private initNext(force?: boolean) {
    if (this.useAsNavigation) {
      return;
    }

    if (!force && this.list.items.length && Util.isEmptyStr(this.list.items[this.list.items.length - 1].name)) {
      return;
    }

    this.newBlankList();
  }

  private newBlankList(position: number = null) {
    let l = this.api.newBlankList(this.list, position);
    l.color = this.list.color;
    this.api.modified(l);
    this.api.setAllPropsSynced(l);
    return l;
  }
}
