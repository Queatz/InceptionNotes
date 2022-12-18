import {
  Component,
  ElementRef,
  OnInit,
  OnChanges,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  HostListener,
  HostBinding,
  ViewChild,
  OnDestroy
} from '@angular/core';

import Util from '../util';
import {ApiService} from '../api.service';
import {UiService, MenuOption} from '../ui.service';
import {ColorPickerComponent} from '../color-picker/color-picker.component';
import {SearchComponent} from '../search/search.component';
import {VillageService} from 'app/village.service';
import {AddPeopleComponent} from 'app/add-people/add-people.component';
import {Config} from 'app/config.service';
import {FilterService} from 'app/filter.service'
import {filter as filterOp, Observable, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {formatDistanceToNow} from 'date-fns';
import {formatDate} from '@angular/common';

@Component({
  selector: 'sub-list',
  templateUrl: './sub-list.component.html',
  styleUrls: ['./sub-list.component.css'],
  host: {
    '[style.background-color]': 'useAsNavigation ? \'transparent\' : list.color',
    '[style.opacity]': 'isDraggingList ? \'0.5\' : undefined',
    '[style.cursor]': 'useAsNavigation ? \'default\' : undefined',
    '[style.max-width]': 'getEnv().showAsPriorityList ? \'32rem\' : undefined',
    '[style.width]': 'getEnv().showAsPriorityList ? \'100%\' : undefined'
  }
})
export class SubListComponent implements OnInit, OnChanges, OnDestroy {

  @Input() list: any;
  @Input() useAsNavigation: boolean;
  @Input() onSelection?: Observable<{ lastList: any | undefined, list: any | undefined, selected: boolean, ctrl: boolean, shift: boolean }>;
  @Input() getSelectedListIds?: Array<string>;
  @Output() modified = new EventEmitter();
  @Output() removed = new EventEmitter();
  @Output() selected = new EventEmitter<{ selected: boolean, ctrl: boolean, shift: boolean }>();
  @Output() onSelectionChange = new EventEmitter<boolean>();

  @ViewChild('element', {static: true}) nameElement: ElementRef;
  @ViewChild('items', {static: false}) itemsElement: ElementRef;

  isDraggingList: boolean;
  isSelected: boolean;
  private isDroppingList: boolean;
  public dropAt: string;
  private isTouch: boolean;
  private dragCounter = 0;
  private mouseDownHack: boolean;

  private destroyed = new Subject<void>();

  constructor(
    private ui: UiService,
    private api: ApiService,
    private filter: FilterService,
    private elementRef: ElementRef,
    private village: VillageService,
    private config: Config) {
  }

  ngOnInit() {
    this.initNext();

    this.onSelection?.pipe(
      takeUntil(this.destroyed),
      filterOp(event => event.list !== this.list)
    ).subscribe(event => {
      if (!event.list) {
        this.isSelected = false
        this.onSelectionChange.emit(this.isSelected);
      } else if (event.shift) {
        if (this.list.parent && event.lastList && event.selected !== this.isSelected) {
          const startIndex = this.list.parent.items.indexOf(event.lastList)
          const endIndex = this.list.parent.items.indexOf(event.list)
          const myIndex = this.list.parent.items.indexOf(this.list)
          if (myIndex >= 0 && startIndex >= 0 && endIndex >= 0) {
            if (startIndex < endIndex) {
              if (myIndex >= startIndex && myIndex <= endIndex) {
                this.isSelected = event.selected;
                this.onSelectionChange.emit(this.isSelected);
              }
            } else {
              if (myIndex >= endIndex && myIndex <= startIndex) {
                this.isSelected = event.selected;
                this.onSelectionChange.emit(this.isSelected);
              }
            }
          }
        }
      } else if (!event.ctrl) {
        this.isSelected = false;
        this.onSelectionChange.emit(this.isSelected);
      }
    })
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.list) {
      this.isSelected = false;
      this.initNext();
    }
  }

  @HostListener('contextmenu', ['$event'])
  showOptions(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const byLinksMenu = (this.list.items as Array<any>)
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


              // Don't touch checked notes
              if (a.checked || b.checked) {
                return 0;
              }

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
        } as MenuOption;
      });

    const options: Array<MenuOption> = [
      {
        title: 'Link...',
        callback: () => this.addToNote(this.list),
        menu: this.getRecentsSubmenu(recent => {
          this.api.addRecent('search', recent.id);
          this.api.addRef(this.list, recent);
          this.focusName()
        }, this.list)
      },
      {
        title: 'Move...',
        callback: () => this.moveToNote(this.list),
        menu: [
          ...this.getRecentsSubmenu(recent => {
            this.api.addRecent('search', recent.id);
            this.api.moveList(this.list.id, recent.id);
          }, this.list),
          ...(this.list.parent?.parent ? [{
            title: '↑ Up to parent',
            callback: () => this.api.moveListUp(this.list, this.list.parent.parent.items.indexOf(this.list.parent) + 1)
          }] : [])
        ]
      },
      {
        title: 'Sort',
        shortcut: '⯈',
        callback: () => {
        },
        menu: [
          {
            title: 'By links',
            shortcut: '⯈',
            callback: () => {
            },
            menu: byLinksMenu.length ? byLinksMenu : [
              {
                title: 'No links',
                callback: (): void => {
                },
                disabled: true
              }
            ]
          },
          {
            title: 'Reverse',
            callback: () => {
              this.list.items.reverse();
              if (this.list.items.length && this.isEmpty(this.list.items[0])) {
                this.moveItemToLastPosition(this.list.items[0])
              }
              this.api.modified(this.list, 'items');
            }
          },
          {
            title: 'Done to bottom',
            callback: () => {
              const lastItem = this.list.items[this.list.items.length - 1];
              this.list.items.sort((a: any, b: any) => {
                if (!a.name && a === lastItem) {
                  return 1;
                } else if (!b.name && b === lastItem) {
                  return -1;
                }

                return a.checked === b.checked ? 0 : a.checked ? 1 : -1;
              });
              this.api.modified(this.list, 'items');
            }
          }
        ]
      },
      {
        title: 'Options',
        shortcut: '⯈',
        callback: () => {},
        menu: [
          {
            title: this.list.options?.enumerate ? 'Un-enumerate' : 'Enumerate', callback: () => {
              if (!this.list.options) {
                this.list.options = {};
              }

              this.list.options.enumerate = !this.list.options.enumerate;

              this.api.modified(this.list, 'options')
            }
          },
          {
            title: 'Invert text color', callback: () => {
              if (!this.list.options) {
                this.list.options = {};
              }

              this.list.options.invertText = !this.list.options.invertText;

              this.api.modified(this.list, 'options')
            }
          }
        ]
      },
      ...(this.village.me() ? [{
        title: 'Add people...',
        callback: () => this.addPeople(this.list),
      }] : []),
      {
        title: 'Change color...',
        callback: () => this.changeColor(),
        menu: (this.getEnv().recentColors || []).slice(0, 3).map(color => ({
          title: color,
          color,
          callback: () => {
            this.ui.addRecentColor(color);
            this.list.color = color;
            this.api.modified(this.list, 'color');
          }
        }))
      },
      ...(this.list.parent ? [{
        title: 'Duplicate',
        callback: () => this.api.duplicateList(this.list)
      }] : []),
      ...(this.list.parent ? [{
        title: this.list.collapsed ? 'Un-collapse' : 'Collapse',
        callback: () => this.toggleCollapse(this.list),
      }] : []),
      {
        title: 'Info', callback: () => {
          const created = this.list.created ? Date.parse(this.list.created) : null;
          const updated = this.list.updated ? Date.parse(this.list.updated) : null;

          const createdStr = !created ? 'Unknown creation date' : `Created ${formatDistanceToNow(created)} ago on ${formatDate(created, 'medium', 'en-US')}`
          const updatedStr = !updated ? 'Note has never been updated' : `Modified ${formatDistanceToNow(updated)} ago on ${formatDate(updated, 'medium', 'en-US')}`

          this.ui.dialog({
            message: `${createdStr}\n\n${updatedStr}`
          })
        }
      },
      {
        title: 'Remove', callback: () => {
          if (this.ui.getEnv().unlinkOnDelete) {
            while (this.list.ref?.length) {
              this.api.removeRef(this.list, this.list.ref[0])
            }
          }

          this.api.removeListFromParent(this.list);
        }
      }
    ];

    this.ui.menu(options, {x: event.clientX, y: event.clientY});
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
      {
        title: 'Link...', callback: () => this.addToNote(item), menu: this.getRecentsSubmenu(recent => {
          this.api.addRecent('search', recent.id);
          this.api.addRef(item, recent);
          this.focusItem(this.visualIndex(item))
        }, item)
      },
      {
        title: 'Move...', callback: () => this.moveToNote(item), menu: [
          ...this.getRecentsSubmenu(recent => {
            this.api.addRecent('search', recent.id);
            this.api.moveList(item.id, recent.id);
          }, item),
          {
            title: '↓ Out',
            callback: () => this.api.moveListUp(item, item.parent.parent.items.indexOf(item.parent) + 1)
          }
        ]
      },
      ...(this.ui.getEnv().showEstimates ? [{
        title: 'Estimate...', callback: () => this.ui.dialog({
          message: 'Estimate (in days)',
          prefill: item.estimate,
          input: true,
          ok: r => {
            item.estimate = Number(r.input);
            this.api.modified(item, 'estimate');
          }
        })
      }] : []),
      {
        title: item.collapsed ? 'Un-collapse' : 'Collapse',
        callback: () => this.toggleCollapse(item),
      },
      ...(item.name.indexOf('<br>') !== -1 ? [{
        title: 'Split by line', callback: () => {
          const position = this.list.items.indexOf(item)
          item.name.split('<br>').reverse().forEach(line => {
            const newItem = this.api.newBlankList(this.list, position)
            newItem.name = line
            this.api.modified(newItem, 'name')
          })

          if (this.ui.getEnv().unlinkOnDelete) {
            while (item.ref?.length) {
              this.api.removeRef(item, item.ref[0])
            }
          }

          this.api.removeListFromParent(item)
        }
      }] : []),
      {
        title: 'Remove', callback: () => {
          if (this.ui.getEnv().unlinkOnDelete) {
            while (item.ref?.length) {
              this.api.removeRef(item, item.ref[0])
            }
          }

          this.api.removeListFromParent(item);
        }
      },
    ], {x: event.clientX, y: event.clientY});
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
        title: 'Apply as filter',
        callback: () => this.filter.toggleRef(refItem)
      },
      {
        title: 'Change to',
        shortcut: '⯈',
        callback: () => {
        },
        menu: [
          ...(refItem.parent?.items || []).filter(x => x !== refItem && x.name.trim()).map(refSibling => ({
            title: refSibling.name,
            callback: () => {
              this.api.addRecent('search', refSibling.id);
              this.api.changeRef(item, refItem, refSibling);
            }
          }))
        ]
      },
      {
        title: 'Order',
        shortcut: '⯈',
        callback: () => {
        },
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
    ], {x: event.clientX, y: event.clientY});
  }

  private toggleCollapse(list: any) {
    list.collapsed = !list.collapsed;
    this.api.modified(list, 'collapsed');
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
            setTimeout(() => this.ui.dialog({message: 'Show links enabled'}));
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
            setTimeout(() => this.ui.dialog({message: 'Show links enabled'}));
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
          this.ui.addRecentColor(result.input);
          this.list.color = result.input;
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

  @HostBinding('style.background-image')
  get styledNote() {
    return !this.useAsNavigation && !this.getEnv().showFlat ? '-webkit-linear-gradient(top, rgba(255, 255, 255, .25), transparent)' : null;
  }

  @HostBinding('draggable')
  get draggable() {
    return this.mouseDownHack && !this.useAsNavigation && !this.isTouch;
  }

  @HostBinding('class.is-selecting-multiple')
  get isSelectingMultipleClass() {
    return this.isSelected;
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

    const ids = this.getSelectedListIds.length ? this.getSelectedListIds : [ this.list.id ]

    event.dataTransfer.setData('application/x-ids', ids.join(','));
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

    const ids = event.dataTransfer.getData('application/x-ids').split(',');

    if (ids.length) {
      if (ids.indexOf(this.list.id) !== -1) {
        this.isDroppingList = false;
        this.dropAt = null;
        this.dragCounter = 0;
        return
      }

      ids.sort((aId, bId) => {
        const a = this.api.search(aId);
        const b = this.api.search(bId);
        return a?.parent?.items?.indexOf(a) - b?.parent?.items?.indexOf(b)
      }).forEach(id => {
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
      })
    } else {
      const text = event.dataTransfer.getData('text/plain');

      if (text) {
        const l = this.newBlankList();
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

    const element = this.elementRef.nativeElement;

    if (!element.getBoundingClientRect) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const percent = Math.max(0, Math.min(element.clientWidth, event.clientX - rect.left) / element.clientWidth);

    if (percent < .25) {
      this.dropAt = 'left';
    } else if (percent < .75) {
      this.dropAt = null;
    } else {
      this.dropAt = 'right';
    }
  }

  openList(event: Event) {
    event.stopPropagation();
    this.api.setEye(this.list);

    return false;
  }

  openItem(event: Event, item: any) {
    event.stopPropagation();
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
    const c = this.countSubItems(item);

    return c ? c + ' sub-item' + (c === 1 ? '' : 's') : 'No sub-items';
  }

  getItemLinkText(item: any) {
    let t = '';
    let p = item.parent;

    for (let i = 0; i < 3 && p; i++) {
      t += ' → ' + p.name;
      p = p.parent;
    }

    return Util.htmlToText(t);
  }

  getAfterText(item: any, ignoreShowSublistPreviews = false) {
    const c = ignoreShowSublistPreviews || this.getEnv().showSublistPreviews ? this.countSubItems(item) : 0;
    const d = this.getEnv().showEstimates ? this.api.getSubItemEstimates(item).reduce((acc: number, val: number) => +acc + +val, 0) : 0;

    const t = c || d ? ' ' + (c ? c + ' item' + (c !== 1 ? 's' : '') : '') + (d && c ? ', ' : '') + (d ? d + ' day' + (d !== 1 ? 's' : '') : '') : '';

    return item.collapsed ? `${t}, collapsed` : t;
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

    const location = this.list.items.indexOf(item);

    if (location === -1 || move === 0) {
      return;
    }

    const dir = move < 0 ? -1 : 1;

    while (location + move > 0 && location + move < this.list.items.length - 1 && this.hideItem(this.list.items[location + move])) {
      move += dir;
    }

    if (move < 0 && location === 0) {
      return;
    }

    if (move > 0 && location === this.list.items.length - 1) {
      if (this.list.parent) {
        const pos = this.list.parent.items.indexOf(this.list);

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

    setTimeout(() => this.focusItem(this.visualIndex(item)));
  }

  onItemEnterPressed(element: any, item: any) {
    const i = this.list.items.indexOf(item);

    if (i === -1) {
      return false;
    }

    const l = this.newBlankList(i + 1);
    setTimeout(() => this.focusItem(this.visualIndex(l)));

    return false;
  }

  onItemBackspacePressed(element: any, item: any) {
    if (Util.isEmptyStr(item.name) && this.list.items.length > 1) {
      const c = this.api.getSubItemNames(item);

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

  hideItem(item: any, includeEmpty = true, includeFiltered = false, internalCall = false) {
    if (this.getEnv().showOnly && (!internalCall && this.visualIndex(item, includeFiltered)) >= this.getEnv().showOnly) {
      return true;
    }

    return (item.checked && this.ui.getEnv().hideDoneItems)
      || !includeFiltered && this.filter.byRef?.length && (item.name || includeEmpty)
      && !item.ref?.find(x => this.filter.byRef.indexOf(x) !== -1);
  }

  hideSubItem(item: any) {
    return this.isEmpty(item) || (item.checked && this.ui.getEnv().hideDoneItems);
  }

  numberHidden(list: any) {
    if (this.filter.byRef?.length < 1 && !this.ui.getEnv().hideDoneItems) {
      return 0;
    }

    return list.items.filter(x => this.hideItem(x, false)).length;
  }

  visualIndex(item: any, includeFiltered = false): number {
    return this.visualIndexOf(this.list, item, includeFiltered)
  }

  visualIndexOf(list: any, item: any, includeFiltered = false): number {
    return list.items.filter(x => !this.hideItem(x, undefined, includeFiltered, true)).indexOf(item);
  }

  countSubItems(item: any) {
    return this.api.getSubItemNames(item).length;
  }

  getEnv() {
    return this.ui.getEnv();
  }

  @HostListener('click', ['$event'])
  dontPropagateClick(event: MouseEvent) {
    event.stopPropagation();

    if (this.useAsNavigation) {
      return
    }

    if (event.target === this.elementRef.nativeElement) {
      this.isSelected = !this.isSelected;
      this.onSelectionChange.emit(this.isSelected);
      this.selected.emit({
        selected: this.isSelected,
        ctrl: event.ctrlKey,
        shift: event.shiftKey
      })
    }
  }

  @HostListener('dblclick', ['$event'])
  dontPropagateDblClick(event: Event) {
    event.stopPropagation();
  }

  public onArrowUpDown(event: Event, item: any, move: number) {
    event.preventDefault();

    const i = this.list.items.filter(x => !this.hideItem(x)).indexOf(item);

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

  public up() {
    this.api.up()
  }

  private getRecentsSubmenu(callback: (recent: any) => void, exclude: any): Array<MenuOption> {
    const recents = this.api.getRecent('search');

    return recents.length ? recents.filter(x => x !== exclude).map(recent => {
      return {
        title: Util.htmlToText(recent.name) +
          (recent.parent ? `<span class="note-parent"> → ${Util.htmlToText(recent.parent.name)}</span>` : ''),
        callback: () => {
          callback(recent);
        }
      } as MenuOption;
    }) : [];
  }

  private deleteItem(element: any, item: any) {
    const i = this.list.items.indexOf(item);
    const vi = this.visualIndex(item);
    this.list.items.splice(i, 1);
    this.api.modified(this.list, 'items');

    if (i === 0) {
      this.focusName();
    } else {
      this.focusItem(vi - 1);
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

  private moveItemToLastPosition(item: any) {
    const location = this.list.items.indexOf(item);

    if (location === -1) {
      return;
    }

    this.list.items.splice(location, 1);
    this.list.items.push(item);
  }

  private newBlankList(position: number = null) {
    const l = this.api.newBlankList(this.list, position);
    l.color = this.list.color;
    l.options = Object.assign({}, this.list.options);
    this.api.modified(l);
    this.api.setAllPropsSynced(l);
    return l;
  }
}
