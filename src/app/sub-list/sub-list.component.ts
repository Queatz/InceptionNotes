import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'

import Util from '../util'
import {ApiService, Note, Invitation} from '../api.service'
import {MenuOption, UiService} from '../ui.service'
import {ColorPickerComponent} from '../color-picker/color-picker.component'
import {SearchComponent} from '../search/search.component'
import {CollaborationService} from 'app/collaboration.service'
import {AddInvitationComponent} from 'app/add-invitation/add-invitation.component'
import {FilterService} from 'app/filter.service'
import {filter as filterOp, Observable, Subject} from 'rxjs'
import {takeUntil} from 'rxjs/operators'
import {formatDistanceToNow} from 'date-fns'
import {formatDate} from '@angular/common'

@Component({
  selector: 'sub-list',
  templateUrl: './sub-list.component.html',
  styleUrls: ['./sub-list.component.css'],
  host: {
    '[style.background-color]': 'useAsNavigation ? \'transparent\' : list.color',
    '[style.opacity]': 'isDraggingList ? \'0.5\' : undefined',
    '[style.cursor]': 'useAsNavigation ? \'default\' : undefined',
    '[style.max-width]': 'large ? \'32rem\' : undefined',
    '[style.width]': 'large ? \'100%\' : undefined'
  }
})
export class SubListComponent implements OnInit, OnChanges, OnDestroy {

  @Input() list: Note
  @Input() large = false
  @Input() useAsNavigation: boolean
  @Input() onSelection?: Observable<{
    lastList: Note | undefined,
    list: Note | undefined,
    selected: boolean,
    ctrl: boolean,
    shift: boolean
  }>
  @Input() getSelectedListIds?: Array<string>
  @Output() modified = new EventEmitter()
  @Output() removed = new EventEmitter()
  @Output() selected = new EventEmitter<{ selected: boolean, ctrl: boolean, shift: boolean }>()
  @Output() onSelectionChange = new EventEmitter<boolean>()

  @ViewChild('element', {static: true}) nameElement: ElementRef
  @ViewChild('items', {static: false}) itemsElement: ElementRef

  isDraggingList: boolean
  isSelected: boolean
  private isDroppingList: boolean
  public dropAt: string
  private isTouch: boolean
  private dragCounter = 0
  private mouseDownHack: boolean

  private destroyed = new Subject<void>()

  constructor(
    private ui: UiService,
    private api: ApiService,
    private collaboration: CollaborationService,
    private filter: FilterService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.initNext()

    this.onSelection?.pipe(
      takeUntil(this.destroyed),
      filterOp(event => event.list !== this.list)
    ).subscribe(event => {
      if (!event.list) {
        this.isSelected = false
        this.onSelectionChange.emit(this.isSelected)
      } else if (event.shift) {
        if (this.list.parent && event.lastList && event.selected !== this.isSelected) {
          const startIndex = this.list.parent.items.indexOf(event.lastList)
          const endIndex = this.list.parent.items.indexOf(event.list)
          const myIndex = this.list.parent.items.indexOf(this.list)
          if (myIndex >= 0 && startIndex >= 0 && endIndex >= 0) {
            if (startIndex < endIndex) {
              if (myIndex >= startIndex && myIndex <= endIndex) {
                this.isSelected = event.selected
                this.onSelectionChange.emit(this.isSelected)
              }
            } else {
              if (myIndex >= endIndex && myIndex <= startIndex) {
                this.isSelected = event.selected
                this.onSelectionChange.emit(this.isSelected)
              }
            }
          }
        }
      } else if (!event.ctrl) {
        this.isSelected = false
        this.onSelectionChange.emit(this.isSelected)
      }
    })
  }

  ngOnDestroy() {
    this.destroyed.next()
    this.destroyed.complete()
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.list) {
      this.isSelected = false
      this.initNext()
    }
  }

  @HostListener('contextmenu', ['$event'])
  showOptions(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    const byLinksMenu = (this.list.items)
      .map(item => item.ref || [])
      .flat()
      .map(ref => ref.parent)
      .filter(list => !!list)
      .filter((v, i, a) => a.indexOf(v) === i)
      .map(refParent => {
        return {
          title: refParent.name,
          callback: () => {
            this.list.items.sort((a: Note, b: Note) => {
              const aRef = a.ref?.find(ref => ref.parent === refParent)
              const bRef = b.ref?.find(ref => ref.parent === refParent)


              // Don't touch checked notes
              if (a.checked || b.checked) {
                return 0
              }

              // Notes without refs to the refParent don't get sorted
              if (!aRef && !bRef) {
                return 0
              }

              // Notes without refs to the refParent get moved down
              if (!aRef !== !bRef) {
                return !aRef ? 1 : -1
              }

              const aPos = refParent.items.indexOf(aRef)
              const bPos = refParent.items.indexOf(bRef)

              return aPos === bPos ? 0 : aPos > bPos ? 1 : -1
            })
            this.api.modified(this.list, 'items')
          }
        } as MenuOption
      })

    const options: Array<MenuOption> = [
      {
        title: 'Link...',
        callback: () => this.addToNote(this.list),
        menu: this.getRecentsSubmenu(recent => {
          this.api.addRecent('search', recent.id)
          this.api.addRef(this.list, recent)
          this.focusName()
        }, this.list)
      },
      {
        title: 'Move...',
        callback: () => this.moveToNote(this.list),
        menu: [
          ...this.getRecentsSubmenu(recent => {
            this.api.addRecent('search', recent.id)
            this.api.moveList(this.list.id, recent.id)
          }, this.list),
          ...(this.list.parent?.parent ? [{
            title: '↑ Up to parent',
            callback: () => this.api.moveListUp(this.list, this.list.parent.parent.items.indexOf(this.list.parent) + 1)
          }] : [])
        ]
      },
      this.scheduleMenuItem(this.list),
      {
        title: 'Invite...',
        callback: () => this.addInvitation(this.list),
        menu: [
          ...this.getRecentInvitationsSubmenu(recent => {
            this.api.addRecentInvitation(recent)
            this.api.addInvitationToNote(this.list, recent)
          }, this.list.invitations || [])
        ]
      },
      {
        title: 'Color...',
        callback: () => this.changeColor(),
        menu: (this.getEnv().recentColors || []).slice(0, 3).map(color => ({
          title: color,
          color,
          callback: () => {
            this.ui.addRecentColor(color)
            this.list.color = color
            this.api.modified(this.list, 'color')
          }
        }))
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
            title: 'A-Z',
            callback: () => {
              if (!this.list.items.length) {
                return
              }

              const last = this.list.items[this.list.items.length - 1]
              this.list.items.sort((a, b) => a.name.localeCompare(b.name))
              if (!last.name) {
                this.moveItemToLastPosition(last)
              }
              this.api.modified(this.list, 'items')
            }
          },
          {
            title: 'Reverse',
            callback: () => {
              this.list.items.reverse()
              if (this.list.items.length && this.isEmpty(this.list.items[0])) {
                this.moveItemToLastPosition(this.list.items[0])
              }
              this.api.modified(this.list, 'items')
            }
          },
          {
            title: 'Done to bottom',
            callback: () => {
              const lastItem = this.list.items[this.list.items.length - 1]
              this.list.items.sort((a: Note, b: Note) => {
                if (!a.name && a === lastItem) {
                  return 1
                } else if (!b.name && b === lastItem) {
                  return -1
                }

                return a.checked === b.checked ? 0 : a.checked ? 1 : -1
              })
              this.api.modified(this.list, 'items')
            }
          }
        ]
      },
      {
        title: 'More',
        shortcut: '⯈',
        callback: () => {
        },
        menu: [
          {
            title: 'Info', callback: () => {
              const created = this.list.created ? Date.parse(this.list.created) : null
              const updated = this.list.updated ? Date.parse(this.list.updated) : null
              const steward = this.api.invitation(this.list.steward)

              const createdStr = !created ? 'Unknown creation date' : `Created ${formatDistanceToNow(created)} ago on ${formatDate(created, 'medium', 'en-US')}`
              const updatedStr = !updated ? 'Note has never been updated' : `Modified ${formatDistanceToNow(updated)} ago on ${formatDate(updated, 'medium', 'en-US')}`
              const stewardStr = !steward ? 'Note steward is unknown' : `The note's steward is ${steward.name}`

              this.ui.dialog({
                message: `${createdStr}\n\n${updatedStr}\n\n${stewardStr}`,
                init: dialog => {
                  this.collaboration.getNoteInvitations(this.list.id).subscribe(
                    invitations => {
                      dialog.config.message += '\n\nInvitations: '
                      dialog.config.message += invitations.map(x => x.name).join(', ')
                    }
                  )
                }
              })
            }
          },
          ...(this.list.parent ? [{
            title: 'Duplicate',
            callback: () => this.api.duplicateList(this.list)
          }, {
            title: this.list.collapsed ? 'Un-collapse' : 'Collapse',
            callback: () => this.toggleCollapse(this.list),
          }] : []),
          {
            title: this.list.options?.enumerate ? 'Un-enumerate' : 'Enumerate', callback: () => {
              if (!this.list.options) {
                this.list.options = {}
              }

              this.list.options.enumerate = !this.list.options.enumerate

              this.api.modified(this.list, 'options')
            }
          },
          {
            title: 'Invert text color', callback: () => {
              if (!this.list.options) {
                this.list.options = {}
              }

              this.list.options.invertText = !this.list.options.invertText

              this.api.modified(this.list, 'options')
            }
          }
        ]
      },
      {
        title: 'Remove', callback: () => {
          if (this.ui.getEnv().unlinkOnDelete) {
            while (this.list.ref?.length) {
              this.api.removeRef(this.list, this.list.ref[0])
            }
          }

          this.api.removeListFromParent(this.list)
        }
      }
    ]

    this.ui.menu(options, {x: event.clientX, y: event.clientY})
  }

  addInvitation(list: Note) {
    this.ui.dialog({
      message: 'Invite',
      input: true,
      view: AddInvitationComponent,
      init: dialog => {
        dialog.changes.subscribe(input => {
          (<AddInvitationComponent>dialog.component.instance).search(input)
        });

        (<AddInvitationComponent>dialog.component.instance).onSelection.subscribe(invitation => {
          dialog.back()
          this.api.addRecentInvitation(invitation)
          this.api.addInvitationToNote(list, invitation)
        })
      }
    })
  }

  me(): Invitation {
    return this.collaboration.me()
  }

  showSubitemOptions(event: MouseEvent, item: Note) {
    event.preventDefault()
    event.stopPropagation()

    this.ui.menu([
      {
        title: 'Link...', callback: () => this.addToNote(item), menu: this.getRecentsSubmenu(recent => {
          this.api.addRecent('search', recent.id)
          this.api.addRef(item, recent)
          this.focusItem(this.visualIndex(item))
        }, item)
      },
      {
        title: 'Move...', callback: () => this.moveToNote(item), menu: [
          ...this.getRecentsSubmenu(recent => {
            this.api.addRecent('search', recent.id)
            this.api.moveList(item.id, recent.id)
          }, item),
          {
            title: '↓ Out',
            callback: () => this.api.moveListUp(item, item.parent.parent.items.indexOf(item.parent) + 1)
          }
        ]
      },
      this.scheduleMenuItem(item),
      ...(this.ui.getEnv().showEstimates ? [{
        title: 'Estimate...', callback: () => this.ui.dialog({
          message: 'Estimate (in days)',
          prefill: item.estimate?.toString(),
          input: true,
          ok: r => {
            item.estimate = Number(r.input)
            this.api.modified(item, 'estimate')
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

          this.api.removeListFromParent(item)
        }
      },
    ], {x: event.clientX, y: event.clientY})
  }

  showRefOptions(event: MouseEvent, item: Note, refItem: Note) {
    event.preventDefault()
    event.stopPropagation()

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
          ...(refItem.parent?.items || []).filter(
            x => x !== refItem && x.name.trim() && item.ref.indexOf(x) === -1
          ).map(refSibling => ({
            title: refSibling.name,
            callback: () => {
              this.api.addRecent('search', refSibling.id)
              this.api.changeRef(item, refItem, refSibling)
            }
          }))
        ]
      },
      ...(item.ref?.length > 1 ? [
        {
          title: 'Order',
          shortcut: '⯈',
          callback: () => {
          },
          menu: [
            ...(item.ref.indexOf(refItem) !== 0 ? [
              {
                title: 'First',
                callback: () => this.api.orderRef(item, refItem, 0)
              }
            ] : []),
            ...(item.ref.indexOf(refItem) !== item.ref.length - 1 ? [
              {
                title: 'Last',
                callback: () => this.api.orderRef(item, refItem, -1)
              }
            ] : [])
          ]
        }
      ] : [])
    ], {x: event.clientX, y: event.clientY})
  }

  private toggleCollapse(list: Note) {
    list.collapsed = !list.collapsed
    this.api.modified(list, 'collapsed')
  }

  private addToNote(item: Note) {
    this.ui.dialog({
      message: 'Link',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val
          dialog.component.instance.ngOnChanges(null)
        })
        dialog.component.instance.onSelection.subscribe(note => {
          this.api.addRef(item, note)
          if (!this.getEnv().showLinks) {
            this.getEnv().showLinks = true
            setTimeout(() => this.ui.dialog({message: 'Show links enabled'}))
          }
          dialog.back()
        })
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.data.results = results
        })
      },
      ok: result => {
        if (result.data.results && result.data.results.length) {
          this.api.addRecent('search', result.data.results[0].id)
          this.api.addRef(item, result.data.results[0])
          if (!this.getEnv().showLinks) {
            this.getEnv().showLinks = true
            setTimeout(() => this.ui.dialog({message: 'Show links enabled'}))
          }
        }
      }
    })
  }

  private moveToNote(item: Note) {
    this.ui.dialog({
      message: 'Move...',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val
          dialog.component.instance.ngOnChanges(null)
        })
        dialog.component.instance.onSelection.subscribe(note => {
          dialog.back()
          this.api.moveList(item.id, note.id)
        })
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.data.results = results
        })
      },
      ok: result => {
        if (result.data.results && result.data.results.length) {
          this.api.addRecent('search', result.data.results[0].id)
          this.api.moveList(item.id, result.data.results[0].id)
        }
      }
    })
  }

  private changeColor() {
    this.ui.dialog({
      message: 'Color',
      input: true,
      prefill: this.list.color,
      view: ColorPickerComponent,
      init: dialog => {
        dialog.component.instance.onColorSelected.subscribe(color => dialog.model.input = color)
        dialog.component.instance.onColorConfirmed.subscribe(color => dialog.clickOk())
      },
      ok: result => {
        if (result.input) {
          this.ui.addRecentColor(result.input)
          this.list.color = result.input
          this.api.modified(this.list, 'color')
        }
      }
    })
  }

  @HostListener('touchstart', ['$event'])
  setIsTouch() {
    this.isTouch = true
  }

  @HostBinding('style.outline')
  get styleOutline() {
    return !this.dropAt && this.isDroppingList ? '3px solid orange' : undefined
  }

  @HostBinding('style.background-image')
  get styledNote() {
    return !this.useAsNavigation && !this.getEnv().showFlat ? '-webkit-linear-gradient(top, rgba(255, 255, 255, .25), transparent)' : null
  }

  @HostBinding('draggable')
  get draggable() {
    return this.mouseDownHack && !this.useAsNavigation && !this.isTouch
  }

  @HostBinding('class.is-selecting-multiple')
  get isSelectingMultipleClass() {
    return this.isSelected
  }

  // Hack for Firefox and Safari
  @HostListener('mousedown', ['$event'])
  mouseDownDraggable(event: Event) {
    if (event.target === this.elementRef.nativeElement) {
      this.mouseDownHack = true
    }
  }

  // Hack for Firefox and Safari
  @HostListener('mouseup', ['$event'])
  mouseUpDraggable(event: Event) {
    this.mouseDownHack = false
  }

  @HostListener('dragstart', ['$event'])
  startDrag(event: DragEvent) {
    if (this.useAsNavigation) {
      return
    }

    event.stopPropagation()

    this.isDraggingList = true

    const ids = this.getSelectedListIds.length ? this.getSelectedListIds : [this.list.id]

    event.dataTransfer.setData('application/x-ids', ids.join(','))
  }

  @HostListener('dragend', ['$event'])
  stopDrag(event: DragEvent) {
    if (this.useAsNavigation) {
      return
    }

    event.stopPropagation()

    this.isDraggingList = false
  }

  @HostListener('dragenter', ['$event'])
  dragOn(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.dragCounter++

    if (!this.isDraggingList) {
      this.isDroppingList = true
    }

    this.setDropAt(event)
  }

  @HostListener('dragleave', ['$event'])
  dragOff(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.dragCounter--

    // This is here to prevent flickering
    if (this.dragCounter < 1) {
      this.isDroppingList = false
      this.dropAt = null
    }
  }

  @HostListener('dragover', ['$event'])
  nothing(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.setDropAt(event)
  }

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    const ids = event.dataTransfer.getData('application/x-ids').split(',')

    if (ids.length) {
      if (ids.indexOf(this.list.id) !== -1) {
        this.isDroppingList = false
        this.dropAt = null
        this.dragCounter = 0
        return
      }

      ids.sort((aId, bId) => {
        const a = this.api.search(aId)
        const b = this.api.search(bId)
        return a?.parent?.items?.indexOf(a) - b?.parent?.items?.indexOf(b)
      }).forEach(id => {
        if (!this.dropAt) {
          this.api.moveList(id, this.list.id)
        } else if (this.dropAt === 'left') {
          if (this.list.parent) {
            this.api.moveListToPosition(id, this.list.parent.id, this.list.parent.items.indexOf(this.list))
          }
        } else if (this.dropAt === 'right') {
          if (this.list.parent) {
            this.api.moveListToPosition(id, this.list.parent.id, this.list.parent.items.indexOf(this.list) + 1)
          }
        }
      })
    } else {
      const text = event.dataTransfer.getData('text/plain')

      if (text) {
        const l = this.newBlankList()
        l.name = text
        this.api.modified(l)
      }
    }

    this.isSelected = false
    this.onSelectionChange.emit(this.isSelected)
    this.selected.emit({
      selected: this.isSelected,
      ctrl: false,
      shift: false
    })

    this.isDroppingList = false
    this.dropAt = null
    this.dragCounter = 0
  }

  setDropAt(event: DragEvent) {
    if (this.isDraggingList) {
      return
    }

    const element = this.elementRef.nativeElement

    if (!element.getBoundingClientRect) {
      return
    }

    const rect = element.getBoundingClientRect()
    const percent = Math.max(0, Math.min(element.clientWidth, event.clientX - rect.left) / element.clientWidth)

    if (percent < .25) {
      this.dropAt = 'left'
    } else if (percent < .75) {
      this.dropAt = null
    } else {
      this.dropAt = 'right'
    }
  }

  openList(event: Event) {
    event.stopPropagation()
    this.api.setEye(this.list)

    return false
  }

  openItem(event: Event, item: Note) {
    event.stopPropagation()
    this.api.setEye(item)

    return false
  }

  showItem(dblclickEvent: Event, item: Note) {
    dblclickEvent.stopPropagation()
    this.api.setShow(item)

    return false
  }

  onNameChange() {
    this.api.modified(this.list, 'name')

    if (this.list.name) {
      this.modified.emit(this.list)
    }
  }

  onItemChecked(item: Note) {
    item.checked = !item.checked
    this.api.modified(item, 'checked')
  }

  isEmpty(item: Note) {
    return Util.isEmptyStr(item.name)
  }

  getSubitemText(item: Note) {
    const c = this.countSubItems(item)

    return c ? c + ' sub-item' + (c === 1 ? '' : 's') : 'No sub-items'
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

  getAfterText(item: Note, ignoreShowSublistPreviews = false) {
    const c = ignoreShowSublistPreviews || this.getEnv().showSublistPreviews ? this.countSubItems(item) : 0
    const d = this.getEnv().showEstimates ? this.api.getSubItemEstimates(item).reduce((acc: number, val: number) => +acc + +val, 0) : 0

    const t = c || d ? ' ' + (c ? c + ' item' + (c !== 1 ? 's' : '') : '') + (d && c ? ', ' : '') + (d ? d + ' day' + (d !== 1 ? 's' : '') : '') : ''

    return item.collapsed ? `${t}, collapsed` : t
  }

  onNameBackspacePressed() {
    if (Util.isEmptyStr(this.list.name)) {
      this.removed.emit()
    }
  }

  onNameEnterPressed() {
    this.newBlankList(0)

    setTimeout(() => {
      this.focusItem(0)
    })

    return false
  }

  onItemChange(item: Note) {
    this.api.modified(item, 'name')

    if (item.name) {
      this.initNext()
      this.modified.emit(item)
    }
  }

  moveItem(event: Event, item: Note, move: number, list?: Note, itemsElement?: HTMLElement) {
    event.stopPropagation()
    event.preventDefault()

    const l = (list || this.list)
    const location = l.items.indexOf(item)

    if (location === -1 || move === 0) {
      return
    }

    const dir = move < 0 ? -1 : 1

    while (location + move > 0 && location + move < l.items.length - 1 && this.hideItem(l.items[location + move])) {
      move += dir
    }

    if (move < 0 && location === 0) {
      return
    }

    if (move > 0 && location === l.items.length - 1) {
      if (l.parent) {
        const pos = l.parent.items.indexOf(l)

        if (pos >= 0 && pos <= l.parent.items.length - 1) {
          this.api.moveListUp(item, pos + 1)
          return
        }
      }

      this.api.moveListUp(item)
    } else {
      l.items.splice(location, 1)
      l.items.splice(location + move, 0, item)
      this.api.modified(this.list, 'items')
    }

    setTimeout(() => this.focusItem(this.visualIndexOf(l, item), list, itemsElement))
  }

  onItemEnterPressed(element: HTMLElement, item: Note) {
    const i = this.list.items.indexOf(item)

    if (i === -1) {
      return false
    }

    const l = this.newBlankList(i + 1)
    setTimeout(() => this.focusItem(this.visualIndex(l)))

    return false
  }

  onItemControlEnterPressed(element: HTMLElement, item: Note) {
    const l = this.newBlankListInList(item, 0)

    // Find sneak peek items container
    let itemsElement: Element = element
    for (let i = 0; i < 3; i++) {
      itemsElement = itemsElement.nextElementSibling
      if (itemsElement.classList.contains('sneak-peek')) {
        break
      }
    }

    setTimeout(() => this.focusItem(this.visualIndexOf(item, l), item, itemsElement as HTMLElement))

    return false
  }

  onItemBackspacePressed(element: HTMLElement, item: Note) {
    if (Util.isEmptyStr(item.name) && this.list.items.length > 1) {
      const c = this.api.getSubItemNames(item)

      if (c.length) {
        this.ui.dialog({
          message: 'Also delete ' + c.length + ' sub-item' + (c.length === 1 ? '' : 's') + '?\n\n' + c.join('\n'),
          ok: () => {
            this.deleteItem(this.itemsElement.nativeElement, this.list, item)
          }
        })
      } else {
        this.deleteItem(this.itemsElement.nativeElement, this.list, item)
      }
    }
  }

  onSubItemEnterPressed(itemsElement: HTMLElement, list: Note, item: Note) {
    const i = list.items.indexOf(item)

    if (i === -1) {
      return false
    }

    const l = this.newBlankListInList(list, i + 1)
    setTimeout(() => this.focusItem(this.visualIndexOf(list, l), list, itemsElement))

    return false
  }

  onSubItemBackspacePressed(itemsElement: HTMLElement, list: Note, item: Note) {
    if (Util.isEmptyStr(item.name) && list.items.length > 1) {
      const c = this.api.getSubItemNames(item)

      if (c.length) {
        this.ui.dialog({
          message: 'Also delete ' + c.length + ' sub-item' + (c.length === 1 ? '' : 's') + '?\n\n' + c.join('\n'),
          ok: () => {
            this.deleteItem(itemsElement, list, item)
          }
        })
      } else {
        this.deleteItem(itemsElement, list, item)
      }
    }
  }

  command(event: Event, command: string) {
    event.preventDefault()
    document.execCommand(command, false, null)
  }

  hideItem(item: Note, includeEmpty = true, includeFiltered = false, internalCall = false) {
    if (this.getEnv().showOnly && (!internalCall && this.visualIndexOf(item.parent, item, includeFiltered)) >= this.getEnv().showOnly) {
      return true
    }

    return (item.checked && this.ui.getEnv().hideDoneItems)
      || !includeFiltered && this.filter.byRef?.length && (item.name || includeEmpty)
      && !item.ref?.find(x => this.filter.byRef.indexOf(x) !== -1)
  }

  hideSubItem(list: Note, item: Note) {
    return this.isLastAndEmpty(list, item) || (item.checked && this.ui.getEnv().hideDoneItems)
  }

  isLastAndEmpty(list: Note, item: Note): boolean {
    return this.isEmpty(item) && list.items.indexOf(item) === list.items.length - 1
  }

  numberHidden(list: Note) {
    if (this.filter.byRef?.length < 1 && !this.ui.getEnv().hideDoneItems) {
      return 0
    }

    return list.items.filter(x => this.hideItem(x, false)).length
  }

  visualIndex(item: Note, includeFiltered = false): number {
    return this.visualIndexOf(this.list, item, includeFiltered)
  }

  visualIndexOf(list: Note, item: Note, includeFiltered = false): number {
    return list.items.filter(x => !this.hideItem(x, undefined, includeFiltered, true)).indexOf(item)
  }

  countSubItems(item: Note) {
    return this.api.getSubItemNames(item).length
  }

  getEnv() {
    return this.ui.getEnv()
  }

  @HostListener('click', ['$event'])
  dontPropagateClick(event: MouseEvent) {
    event.stopPropagation()

    if (this.useAsNavigation) {
      return
    }

    if (event.target === this.elementRef.nativeElement) {
      this.isSelected = !this.isSelected
      this.onSelectionChange.emit(this.isSelected)
      this.selected.emit({
        selected: this.isSelected,
        ctrl: event.ctrlKey,
        shift: event.shiftKey
      })
    }
  }

  @HostListener('dblclick', ['$event'])
  dontPropagateDblClick(event: Event) {
    event.stopPropagation()
  }

  onArrowUpDown(event: Event, item: Note, move: number, list?: Note, itemsElement?: HTMLElement) {
    event.preventDefault()

    const i = this.visualIndexOf(list || this.list, item)

    if (i === -1) {
      return
    }

    if (!this.focusItem(i + move, list, itemsElement)) {
      if (!list) {
        this.focusName()
      }
    }
  }

  private focusName() {
    this.nameElement.nativeElement.focus()
  }

  focusItem(index: number, list?: Note, element?: HTMLElement) {
    if (index < 0 || index >= (list || this.list).items.length) {
      return false
    }

    (element || this.itemsElement.nativeElement)
      .children[index]
      .querySelector('[contentEditable]')
      .focus()

    return true
  }

  up() {
    this.api.up()
  }

  private getRecentsSubmenu(callback: (recent: Note) => void, exclude: Note): Array<MenuOption> {
    const recents = this.api.getRecent('search')

    return recents.length ? recents.filter(x => x !== exclude).map(recent => {
      return {
        title: Util.htmlToText(recent.name) +
          (recent.parent ? `<span class="note-parent"> → ${Util.htmlToText(recent.parent.name)}</span>` : ''),
        callback: () => {
          callback(recent)
        }
      } as MenuOption
    }) : []
  }
  private getRecentInvitationsSubmenu(callback: (recent: Invitation) => void, exclude: Invitation[] = []): Array<MenuOption> {
    const recents = this.api.getRecentInvitations().filter(x => exclude.indexOf(x) === -1)

    return recents.map(recent => {
      return {
        title: recent.name,
        invitation: recent,
        callback: () => {
          callback(recent)
        }
      } as MenuOption
    })
  }

  private deleteItem(itemsElement: HTMLElement, list: Note, item: Note) {
    const i = list.items.indexOf(item)
    const vi = this.visualIndexOf(list, item)
    list.items.splice(i, 1)
    this.api.modified(list, 'items')

    if (i === 0) {
      if (!list) {
        this.focusName()
      } else {
        this.focusItem(this.visualIndex(list))
      }
    } else {
      this.focusItem(vi - 1, list, itemsElement)
    }
  }

  private initNext() {
    if (this.useAsNavigation) {
      return
    }

    if (this.list.items.length && Util.isEmptyStr(this.list.items[this.list.items.length - 1].name)) {
      return
    }

    this.newBlankList()
  }

  private moveItemToLastPosition(item: Note) {
    const location = this.list.items.indexOf(item)

    if (location === -1) {
      return
    }

    this.list.items.splice(location, 1)
    this.list.items.push(item)
  }

  private newBlankList(position: number = null) {
    return this.newBlankListInList(this.list, position)
  }

  private newBlankListInList(list: Note, position: number = null) {
    const l = this.api.newBlankList(list, position)
    l.color = list.color
    l.options = Object.assign({}, list.options)
    this.api.modified(l)
    return l
  }

  showInvitationMenu(event: MouseEvent, item: Note, invitation: Invitation) {
    event.stopPropagation()
    event.preventDefault()

    if (invitation.id === item.steward && !item.invitations?.find(i => i.id === item.steward)) {
      this.ui.dialog({
        message: `${invitation.name} is the note's steward and cannot be uninvited.`
      })
      return
    }

    this.ui.menu(
      [
        {
          title: 'Remove', callback: () => {
            this.ui.dialog({
              message: `Remove this invitation?\n\n${invitation.name} will no longer be a collaborator on this note.`,
              ok: () => {
                const i = item.invitations.indexOf(invitation)

                if (i === -1) {
                  return
                }

                item.invitations.splice(i, 1)
                this.api.modified(item, 'invitations')
              }
            })
          }
        }
      ],
      {x: event.clientX, y: event.clientY}
    )
  }

  getInvitations(list: Note): Array<Invitation> {
    const l = [ ...(list.invitations || []) ]
    if (l.length && list.steward && !l.find(i => i.id === list.steward)) {
      l.unshift(this.api.invitation(list.steward))
    }
    return l
  }

  goUpText() {
    if (this.list.parent) {
      return `Go up to "${this.list.parent.name}"`
    } else {
      return 'New top note'
    }
  }

  private scheduleMenuItem(item: Note) {
    return {
      title: 'Schedule...',
      callback: () => {},
      menu: [
        {
          title: 'By today',
          callback: () => {}
        },
        {
          title: 'By tomorrow',
          callback: () => {}
        },
        {
          title: '6pm today',
          callback: () => {}
        },
        {
          title: 'From Feb 1',
          callback: () => {}
        },
        {
          title: 'On Feb 15, 2024',
          callback: () => {}
        },
        {
          title: 'Duration...',
          callback: () => {}
        }
      ]
    }
  }
}
