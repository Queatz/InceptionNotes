import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges, OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  ViewContainerRef
} from '@angular/core'
import {ApiService, Note} from '../api.service'
import {UiService} from '../ui.service'
import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInWeeks,
  getHours,
  getWeeksInMonth,
  isBefore,
  isSameDay,
  isSameHour,
  isSameMonth,
  isSameSecond,
  isSameWeek,
  isSameYear,
  isThisHour,
  isThisMonth,
  isThisWeek,
  isThisYear,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
  startOfHour, startOfMinute,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns'
import {formatDate} from '@angular/common'
import {ScrollableAreaComponent} from '../scrollable-area/scrollable-area.component'
import {OpComponent} from '../op/op.component'
import {SearchComponent} from '../search/search.component'
import {FilterService} from '../filter.service'
import {CollaborationService} from '../collaboration.service'
import {GranularityValue} from '../schedule-nav/schedule-nav.component'
import {debounceTime, filter as filterOp, Subject} from 'rxjs'
import {takeUntil} from 'rxjs/operators'

class ScheduleColumn {
  range: Date
  name: string
  title: string
  past: boolean
  items: Array<Note>
}

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css'],
  host: {
    '[class.dark-theme]': `ui.getEnv().useDarkTheme`
  }
})
export class ScheduleComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {

  @Input() granularity: GranularityValue

  offset = 0
  count = 3

  columns = new Array<ScheduleColumn>()
  shift = 0

  parseISO = parseISO

  // todo convert to maps, watch noteChanges('date')
  private allNotes = Array.from(this.api.getAllNotes().values())

  @ViewChild('schedule', {read: ViewContainerRef, static: true})
  private schedule: ViewContainerRef

  @ViewChild('viewport', {read: ViewContainerRef, static: true})
  private viewport: ViewContainerRef

  @ViewChild('viewport', {static: true})
  private scrollableArea: ScrollableAreaComponent

  private destroyed = new Subject<void>()

  constructor(
    private api: ApiService,
    public ui: UiService,
    private filter: FilterService,
    private collaboration: CollaborationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.api.onNoteUpdatedObservable.pipe(
      takeUntil(this.destroyed),
      filterOp(changes => changes.property === 'date'),
      debounceTime(50)
    ).subscribe(() => {
      this.calcItems()
      this.changeDetectorRef.detectChanges()
    })
  }

  ngAfterViewInit(): void {
    this.reset()
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('granularity' in changes) {
      this.reset()
    }
  }

  ngOnDestroy() {
    this.destroyed.next()
    this.destroyed.complete()
  }

  reset() {
    this.calcItems()
    this.onScroll(this.offset)
  }

  calcItems(shift?: number) {
    if (shift && Math.abs(shift) < this.count - 1) {
      if (shift > 0) {
        this.columns.splice(0, shift)
        for (let i = 0; i < shift; i++) {
          this.columns.push(this.getColumn(this.shift + this.count + i))
        }
      } else {
        this.columns.splice(shift, -shift)
        for (let i = shift + 1; i <= 0; i++) {
          this.columns.unshift(this.getColumn(this.shift + i))
        }
      }
    } else {
      this.columns.length = 0
      for (let i = 0; i < this.count; i++) {
        this.columns.push(this.getColumn(this.shift + i))
      }
    }
    this.changeDetectorRef.detectChanges()
  }

  getColumn(position: number) {
    const startOfRange = this.startOfRangeNow()
    const range = this.addRange(startOfRange, position)
    const all = this.allNotes.filter(note => this.isInRange(parseISO(note.date), range))
    return {
      range,
      name: this.formatRange(range, true),
      title: this.formatRange(range),
      past: isBefore(range, startOfRange),
      items: all.sort((a, b) => isSameSecond(parseISO(a.date), parseISO(b.date)) ? 0 : isBefore(parseISO(a.date), parseISO(b.date)) ? -1 : 1)
    }
  }

  shiftBy(amount: number) {
    this.shift += amount
    this.calcItems(amount)
  }

  onScroll(offset: number) {
    if (!this.schedule.element.nativeElement.childElementCount) {
      return
    }

    if (this.shouldShiftLeft(offset)) {
      const size = this.schedule.element.nativeElement.firstElementChild.offsetWidth
      const span = Math.ceil(Math.abs(this.offset - offset) / size)
      this.offset -= span * size
      this.shiftBy(-span)
      this.schedule.element.nativeElement.style.left = `${this.offset}px`
      if (this.shouldShiftRight(offset)) {
        this.expand()
        this.onScroll(offset)
      }
    } else if (this.shouldShiftRight(offset)) {
      const size = this.schedule.element.nativeElement.lastElementChild.offsetWidth
      const span = Math.ceil(
        Math.abs(this.offset + this.schedule.element.nativeElement.offsetWidth
          - this.viewport.element.nativeElement.offsetWidth - offset) / size
      )
      this.offset += span * size
      this.shiftBy(span)
      this.schedule.element.nativeElement.style.left = `${this.offset}px`
      if (this.shouldShiftLeft(offset)) {
        this.expand()
        this.onScroll(offset)
      }
    }
  }

  @HostListener('contextmenu', ['$event'])
  menu(event: MouseEvent) {
    event.preventDefault()
    this.ui.menu([
      {title: 'Filter...', shortcut: 'ALT + F', callback: () => this.showFilter(null)},
      {title: 'Change background...', callback: () => this.changeBackground()},
      {title: 'Options...', shortcut: 'ALT + O', callback: () => this.showOptions(null)},
    ], {x: event.clientX, y: event.clientY})
  }

  @HostListener('window:keydown.alt.o', ['$event'])
  showOptions(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    this.ui.dialog({
      view: OpComponent
    })
  }

  @HostListener('window:keydown.alt.s', ['$event'])
  showSearch(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    this.ui.dialog({
      message: 'Search',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val
          dialog.component.instance.ngOnChanges(null)
        })
        dialog.component.instance.onSelection.subscribe(note => {
          this.api.addRecent('search', note.id)
          this.api.setEye(note)
          dialog.back()
        })
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.data.results = results
        })
      },
      ok: result => {
        if (result.data.results && result.data.results.length) {
          this.api.addRecent('search', result.data.results[0].id)
          this.api.setEye(result.data.results[0])
        }
      }
    })
  }

  @HostListener('window:keydown.alt.f', ['$event'])
  showFilter(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    this.ui.dialog({
      message: 'Filter by links',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.component.instance.recentWhich = 'filter'
        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val
          dialog.component.instance.ngOnChanges(null)
        })
        dialog.component.instance.onSelection.subscribe(note => {
          this.api.addRecent('filter', note.id)
          this.filter.toggleRef(note)
          dialog.back()
        })
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.data.results = results
        })
      },
      ok: result => {
        if (result.data.results && result.data.results.length) {
          this.api.addRecent('filter', result.data.results[0].id)
          this.filter.toggleRef(result.data.results[0])
        }
      }
    })
  }

  @HostListener('window:keydown.alt.p')
  showAsPriority(event: Event) {
    this.ui.getEnv().showAsPriorityList = !this.ui.getEnv().showAsPriorityList
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane
    this.ui.save()
  }

  @HostListener('dblclick', ['$event'])
  toggleSidepane(event: Event) {
    this.dontPropagate(event)
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane
    this.ui.save()
  }

  setNow() {
    this.scrollableArea.scrollTo(0)
  }

  changeBackground() {

  }

  dontPropagate(event: Event) {
    event.stopPropagation()
    event.preventDefault()
  }

  private expand() {
    this.count += 2
    this.calcItems()
  }

  private shouldShiftLeft(offset: number) {
    return offset < this.offset
  }

  private shouldShiftRight(offset: number) {
    return offset > this.offset + this.schedule.element.nativeElement.offsetWidth - this.viewport.element.nativeElement.offsetWidth
  }

  private startOfRangeNow() {
    switch (this.granularity) {
      case 'year':
        return startOfYear(new Date())
      case 'month':
        return startOfMonth(new Date())
      case 'week':
        return startOfWeek(new Date())
      case 'day':
        return startOfDay(new Date())
      case 'hour':
        return startOfHour(new Date())
      default:
        return new Date(0)
    }
  }

  private addRange(date: Date, amount: number) {
    switch (this.granularity) {
      case 'year':
        return addYears(date, amount)
      case 'month':
        return addMonths(date, amount)
      case 'week':
        return addWeeks(date, amount)
      case 'day':
        return addDays(date, amount)
      case 'hour':
        return addHours(date, amount)
      default:
        return new Date(0)
    }
  }

  private startOfSubRange(date: Date, offset: number) {
    switch (this.granularity) {
      case 'year':
        return this.addSubRange(startOfMonth(date), offset)
      case 'month':
        return this.addSubRange(startOfWeek(date), offset)
      case 'week':
        return this.addSubRange(startOfDay(date), offset)
      case 'day':
        return this.addSubRange(startOfHour(date), offset)
      case 'hour':
        return this.addSubRange(startOfMinute(date), offset)
      default:
        return new Date(0)
    }
  }

  private addSubRange(date: Date, amount: number) {
    switch (this.granularity) {
      case 'year':
        return addMonths(date, amount)
      case 'month':
        return addWeeks(date, amount)
      case 'week':
        return addDays(date, amount)
      case 'day':
        return addHours(date, amount)
      case 'hour':
        return addMinutes(date, amount)
      default:
        return new Date(0)
    }
  }

  private isInRange(date: Date, range: Date) {
    switch (this.granularity) {
      case 'year':
        return isSameYear(date, range)
      case 'month':
        return isSameMonth(date, range)
      case 'week':
        return isSameWeek(date, range)
      case 'day':
        return isSameDay(date, range)
      case 'hour':
        return isSameHour(date, range)
      default:
        return false
    }
  }

  private formatRange(range: Date, relative = false) {
    switch (this.granularity) {
      case 'year':
        return relative && isSameYear(range, addYears(new Date(), -1)) ? 'Last year' : relative && isThisYear(range) ? 'This year' : relative && isSameYear(range, addYears(new Date(), 1)) ? 'Next year' : `${formatDate(range, 'yyyy', 'en-US')}`
      case 'month':
        return relative && isSameMonth(range, addMonths(new Date(), -1)) ? 'Last month' : relative && isThisMonth(range) ? 'This month' : relative && isSameMonth(range, addMonths(new Date(), 1)) ? 'Next month' : `${formatDate(range, 'MMMM, yyyy', 'en-US')}`
      case 'week':
        return relative && isSameWeek(range, addWeeks(new Date(), -1)) ? 'Last week' : relative && isThisWeek(range) ? 'This week' : relative && isSameWeek(range, addWeeks(new Date(), 1)) ? 'Next week' : `${formatDate(range, 'MMM d', 'en-US')} ‒ ${formatDate(addWeeks(range, 1), 'MMM d', 'en-US')}`
      case 'day':
        return relative && isYesterday(range) ? 'Yesterday' : relative && isToday(range) ? 'Today' : relative && isTomorrow(range) ? 'Tomorrow' : `${formatDate(range, 'EEEE, MMM d', 'en-US')}`
      case 'hour':
        return relative && isSameHour(range, addHours(new Date(), -1)) ? 'Last hour' : relative && isThisHour(range) ? 'This hour' : relative && isSameHour(range, addHours(new Date(), 1)) ? 'Next hour' : `${formatDate(range, relative && getHours(range) !== 0 ? 'h a' : 'MMM d, h a', 'en-US')}`
      default:
        return '-'
    }
  }

  fullRangeEmpty(range: Date) {
    switch (this.granularity) {
      case 'year':
        return '12 months'
      case 'month':
        return `${getWeeksInMonth(range) - 1} weeks`
      case 'week':
        return '7 days'
      case 'day':
        return '24 hours'
      case 'hour':
        return '60 minutes'
      default:
        return false
    }
  }

  intervalsSinceStartOfRange(range: Date, date: Date) {
    return this.intervalsSinceDate(range, date)
  }

  intervalsUntilEndOfRange(range: Date, date: Date) {
    return this.intervalsSinceDate(date, this.addRange(range, 1), true)
  }

  intervalsSinceDate(date: Date, dateSince: Date, gobble = false) {
    switch (this.granularity) {
      case 'year':
        return differenceInMonths(dateSince, gobble ? this.startOfSubRange(date, 1) : date)
      case 'month':
        return differenceInWeeks(dateSince, gobble ? this.startOfSubRange(date, 1) : date)
      case 'week':
        return differenceInDays(dateSince, gobble ? this.startOfSubRange(date, 1) : date)
      case 'day':
        return differenceInHours(dateSince, gobble ? this.startOfSubRange(date, 1) : date)
      case 'hour':
        return differenceInMinutes(dateSince, gobble ? this.startOfSubRange(date, 1) : date)
      default:
        return 0
    }
  }

  formatEmptySpan(count: number) {
    switch (this.granularity) {
      case 'year':
        return `${count} month${count === 1 ? '' : 's'}`
      case 'month':
        return `${count} week${count === 1 ? '' : 's'}`
      case 'week':
        return `${count} day${count === 1 ? '' : 's'}`
      case 'day':
        return `${count} hour${count === 1 ? '' : 's'}`
      case 'hour':
        return `${count} minute${count === 1 ? '' : 's'}`
      default:
        return ''
    }
  }
}
