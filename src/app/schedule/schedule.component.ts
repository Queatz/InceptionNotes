import {ChangeDetectorRef, Component, OnInit, ViewChild, ViewContainerRef} from '@angular/core'
import {ApiService, Note} from '../api.service'
import {UiService} from '../ui.service'
import {addDays, addHours, addMonths, addWeeks, getHours, isPast, isToday, isTomorrow, isYesterday} from 'date-fns'
import {formatDate} from '@angular/common'
import {ScrollableAreaComponent} from '../scrollable-area/scrollable-area.component';

class ScheduleColumn {
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
export class ScheduleComponent implements OnInit {

  list: Note

  offset = 0
  count = 3

  columns = new Array<ScheduleColumn>()
  shift = 0

  @ViewChild('schedule', {read: ViewContainerRef, static: true})
  private schedule: ViewContainerRef

  @ViewChild('viewport', {read: ViewContainerRef, static: true})
  private viewport: ViewContainerRef

  @ViewChild('viewport', {static: true})
  private scrollableArea: ScrollableAreaComponent

  constructor(private api: ApiService, private ui: UiService, private changeDetectorRef: ChangeDetectorRef) {
    this.list = this.api.getEye()
  }

  ngOnInit() {
    this.calcItems()
    this.onScroll(0)
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
    const date = addDays(new Date(), position)
    const all = Array.from(this.api.getAllNotes().values()).filter(x => x.name)
    const weekRange = `${formatDate(date, 'MMM d', 'en-US')} to ${formatDate(addWeeks(date, 1), 'MMM d', 'en-US')}`
    const month = `${formatDate(addMonths(new Date(), position), 'MMMM, yyyy', 'en-US')}`
    const hourDate = addHours(new Date(), position)
    const hour = `${formatDate(hourDate, getHours(hourDate) !== 0 ? 'h a' : 'h a (MMM d)', 'en-US')}`
    return {
      name: isYesterday(date) ? 'Yesterday' : isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : `${formatDate(date, 'EEEE, MMM d', 'en-US')}`,
      // name: isYesterday(date) ? 'Last week' : isToday(date) ? 'This week' : isTomorrow(date) ? 'Next week' : weekRange,
      // name: isYesterday(date) ? 'Last month' : isToday(date) ? 'This month' : isTomorrow(date) ? 'Next month' : month,
      // name: isToday(date) ? 'This hour' : hour,
      title: month,
      past: isPast(date),
      items: all.sort((a, b) => Math.random() - .5).slice(0, Math.round(Math.random() * 4))
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
}
