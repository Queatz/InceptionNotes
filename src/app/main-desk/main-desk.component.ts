import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewContainerRef
} from '@angular/core'
import {ApiService, Note} from '../api.service'
import {MenuOption, UiService} from '../ui.service'
import Util from 'app/util'
import {FilterService} from 'app/filter.service'
import {Subject} from 'rxjs'
import {takeUntil} from 'rxjs/operators'

@Component({
  selector: 'main-desk',
  templateUrl: './main-desk.component.html',
  styleUrls: ['./main-desk.component.css'],
  host: {
    '[style.background-color]': 'list.backgroundUrl && list.backgroundUrl.indexOf(\'//\') === -1 ? list.backgroundUrl : (getEnv().useDarkTheme ? \'#404040\' : undefined)',
    '[style.background-image]': 'list.backgroundUrl && list.backgroundUrl.indexOf(\'//\') !== -1 ? (\'url(\' + list.backgroundUrl + \')\') : undefined'
  }
})
export class MainDeskComponent implements OnInit, OnChanges, OnDestroy {

  @Input() list: Note

  @ViewChild('listsContainer', {read: ViewContainerRef}) listsContainer: ViewContainerRef

  private destroyed = new Subject<void>()

  private lastListSelected?: Note
  readonly onSelection: Subject<{
    lastList?: Note,
    list?: Note,
    selected: boolean,
    ctrl: boolean,
    shift: boolean
  }> = new Subject()

  private readonly selectedListIds = new Set<string>()

  constructor(
    public api: ApiService,
    public filter: FilterService,
    public ui: UiService,
    private elementRef: ElementRef) {
  }

  getSelectedListIds(): Array<string> {
    return Array.from(this.selectedListIds.values())
  }

  ngOnInit() {
    this.initNext()

    this.ui.locate.pipe(
      takeUntil(this.destroyed)
    ).subscribe(locate => {
      const idx = this.getLists().indexOf(locate.list)

      if (document.documentElement && idx !== -1) {
        const y = ((this.listsContainer.element.nativeElement as HTMLDivElement).children[idx] as HTMLDivElement).offsetTop -
          Util.convertRemToPixels(1)
        document.documentElement.scrollTo({
          top: y,
          behavior: locate.animate === false ? 'auto' : 'smooth'
        })
      }
    })
  }

  ngOnDestroy() {
    this.destroyed.next()
    this.destroyed.complete()
  }

  ngOnChanges(changes: SimpleChanges) {
    this.initNext()
  }

  onItemModified(item: Note) {
    this.initNext()
  }

  onItemRemoved(item: Note) {
    if (this.getLists().length > 1) {
      const c = this.api.getSubItemNames(item)

      if (!c.length) {
        this.removeItem(item)
      } else {
        this.ui.dialog({
          message: 'Also delete ' + c.length + ' sub-item' + (c.length === 1 ? '' : 's') + '?\n\n' + c.join('\n'),
          ok: () => {
            this.removeItem(item)
          }
        })
      }
    }
  }

  onItemSelected(list: Note, event: { selected: boolean, ctrl: boolean, shift: boolean }) {
    this.onSelection.next(
      {
        lastList: this.lastListSelected,
        list,
        selected: event.selected,
        ctrl: event.ctrl,
        shift: event.shift
      }
    )
    this.lastListSelected = list

    if (!event.selected && !event.ctrl && !event.shift) {
      this.lastListSelected = null
      this.selectedListIds.clear()
    }
  }

  private removeItem(item: Note) {
    this.list.items.splice(this.list.items.indexOf(item), 1)
    this.api.modified(this.list, 'items')
  }

  saveDescription() {
    this.api.modified(this.list, 'description')
  }

  dontPropagate(event: Event) {
    event.stopPropagation()
    event.preventDefault()
  }

  changeBackground() {
    this.ui.dialog({
      message: 'Change background image url or color',
      input: true,
      prefill: this.list.backgroundUrl || '',
      ok: result => {
        if (result.input) {
          this.list.backgroundUrl = result.input
          this.api.modified(this.list, 'backgroundUrl')
        }
      }
    })
  }

  moveItem(event: Event, item: Note, move: number) {
    const location = this.list.items.indexOf(item)

    if (location === -1) {
      return
    }

    if (move < 0 && location === 0) {
      return
    }

    if (move > 0 && location === this.list.items.length - 1) {
      return
    }

    this.list.items.splice(location, 1)
    this.list.items.splice(location + move, 0, item)
    this.api.modified(this.list, 'items')

    setTimeout(() =>
      this.elementRef.nativeElement.querySelectorAll('sub-list')[(location + move)]
        .querySelector('.sub-list-title').focus())
  }

  getShow() {
    return this.list
  }

  getLists() {
    return this.list.items
  }

  getEnv() {
    return this.ui.getEnv()
  }

  command(event: Event, command: string) {
    event.preventDefault()
    document.execCommand(command, false, null)
  }

  removeDescriptionIfEmpty(event: Event) {
    if (this.list.description.replace('<br>', '') === '') {
      event.preventDefault()
      this.list.description = null
      this.api.modified(this.list, 'description')
    }
  }

  @HostListener('contextmenu', ['$event'])
  menu(event: MouseEvent) {
    event.preventDefault()

    let opts: Array<MenuOption> = [
      {title: 'Change background...', callback: () => this.changeBackground()},
    ]

    this.ui.menu([
      {title: 'New note', callback: () => this.newNoteAtPosition(event.pageX, event.pageY)},
      ...(!this.list.description && this.list.description !== '' ? [
        {
          title: 'Add description', callback: () => {
            if (!this.list.description && this.list.description !== '') {
              this.list.description = ''
              this.api.modified(this.list, 'description')
            }
          }
        }
      ] : []),
      ...opts
    ], {x: event.clientX, y: event.clientY})
  }

  @HostListener('window:keydown.alt.p')
  showAsPriority(event: Event) {
    const showAsPriorityList = !this.ui.getEnv().showAsPriorityList
    this.ui.getEnv().showAsPriorityList = showAsPriorityList
    this.ui.getEnv().sidepane = !showAsPriorityList
    this.ui.save()
  }

  @HostListener('dblclick', ['$event'])
  toggleSidepane(event: Event) {
    this.dontPropagate(event)
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane
    this.ui.save()
  }

  @HostListener('click', ['$event'])
  unselectAll(event: Event) {
    this.dontPropagate(event)

    if (this.getLists().length > 0) {
      this.onSelection.next(
        {
          lastList: undefined,
          list: undefined,
          selected: false,
          ctrl: false,
          shift: false
        }
      )
    }
  }

  onSelectionChange(list: Note, selected: boolean) {
    if (selected) {
      this.selectedListIds.add(list.id)
    } else {
      this.selectedListIds.delete(list.id)
    }
  }

  goUpText() {
    if (this.list.parent) {
      return `Go up to "${this.list.parent.name}"`
    } else {
      return 'New top note'
    }
  }

  private initNext() {
    const items = this.getLists()

    if (items.length && Util.isEmptyStr(this.list.items[items.length - 1].name)) {
      return
    }

    const l = this.api.newBlankList(this.list)
    l.color = this.getShow().color
    l.options = { ...this.getShow().options }
    this.api.modified(l)
  }

  up() {
    this.api.up()
  }

  private newNoteAtPosition(x: number, y: number) {
    const children = [...this.listsContainer.element.nativeElement.childNodes]
    let notes: Array<any> = children.map((child, index) => {
      return {
        match: (x > child.offsetLeft + child.offsetWidth && y > child.offsetTop) ||
          (x > child.offsetLeft && y > child.offsetTop + child.offsetHeight),
        index
      }
    }).filter(item => item.match)

    let note = notes[notes.length - 1]
    let indexOffset = 0

    if (!note) {
      notes = children.map((child, index) => {
        return {
          match: y > child.offsetTop,
          y: child.offsetTop,
          index
        }
      }).filter(item => item.match)

      while (notes.length > 1 && notes[notes.length - 1].y === notes[notes.length - 2].y) {
        notes.pop()
      }

      note = notes[notes.length - 1]
      indexOffset = -1
    }

    const l = this.api.newBlankList(this.list, note ? note.index + 1 + indexOffset : 0)
    l.color = this.getShow().color
    l.options = this.getShow().options
    this.api.modified(l)
  }
}
