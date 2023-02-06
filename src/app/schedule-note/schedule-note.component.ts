import {Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewContainerRef} from '@angular/core'
import {addDays, addHours, addMinutes, format, isThisYear, isToday, isTomorrow, parse, startOfHour, startOfMinute} from 'date-fns'
import {rawTimeZones} from '@vvo/tzdb'
import {Subject} from 'rxjs'

const monthDayYear = 'MMMM do, yyyy'
const weekdayMonthDay = 'eeee, MMMM do'
const weekdayMonthDayYear = 'eeee, MMMM do, yyyy'
const hourMinuteAmPm = 'h:mma'

@Component({
  selector: 'app-schedule-note',
  templateUrl: './schedule-note.component.html',
  styleUrls: ['./schedule-note.component.css']
})
export class ScheduleNoteComponent implements OnInit, OnChanges, OnDestroy {

  @Input() date: Date

  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  onDateChange = new Subject<Date>()
  dateSuggestions: Array<[Date, string]>
  timeSuggestions: Array<[Date, string]>
  timeZoneSuggestions: Array<[string, string]>

  @ViewChild('date', { static: true, read: ViewContainerRef })
  dateRef: ViewContainerRef

  @ViewChild('time', { static: true, read: ViewContainerRef })
  timeRef: ViewContainerRef

  @ViewChild('timeZone', { static: true, read: ViewContainerRef })
  timezoneRef: ViewContainerRef

  ngOnInit() {
    if (!this.date) {
      this.ngOnChanges()
    }
  }

  ngOnDestroy() {
    this.onDateChange.complete()
  }

  ngOnChanges(changes?: SimpleChanges) {
    if (!this.date) {
      this.date = startOfMinute(new Date())
      this.resuggest()
    } else {
      this.dateChanged()
    }
  }

  setDateString(dateString: string) {
    const date = parse(dateString, monthDayYear, this.date)
    if (!isNaN(date.valueOf())) {
      this.setDate(date)
    } else {
      const from = startOfMinute(new Date())
      this.setDateHourMinute(from, this.date)
      this.resuggestDate(from)
    }
  }

  setTimeString(dateString: string) {
    const date = parse(dateString, hourMinuteAmPm, this.date)
    if (!isNaN(date.valueOf())) {
      this.setTime(date)
    } else {
      const from = startOfMinute(new Date())
      this.setDateMonthDayYear(from, this.date)
      this.resuggestTime(from)
    }
  }

  setDate(date: Date) {
    this.setDateMonthDayYear(this.date, date)
    this.dateChanged()
  }

  setTime(date: Date) {
    this.setDateHourMinute(this.date, date)
    this.dateChanged()
  }

  setDateMonthDayYear(date: Date, update: Date) {
    date.setFullYear(update.getFullYear())
    date.setMonth(update.getMonth())
    date.setDate(update.getDate())
  }

  setDateHourMinute(date: Date, update: Date) {
    date.setHours(update.getHours())
    date.setMinutes(update.getMinutes())
  }

  dateChanged() {
    const date = (this.dateRef.element.nativeElement as HTMLInputElement)
    const time = (this.timeRef.element.nativeElement as HTMLInputElement)
    date.value = format(this.date, monthDayYear)
    time.value = format(this.date, hourMinuteAmPm).toLowerCase()
    this.resuggest()
    this.onDateChange.next(this.date)
  }

  dateNow() {
    return format(new Date(), monthDayYear)
  }

  timeNow() {
    return format(new Date(), hourMinuteAmPm).toLowerCase()
  }

  getTimeZone() {
    return this.tzToStr(this.timeZone)
  }

  setTimeZone(value: string, autocomplete = false) {
    const timeZones = this.findTimeZones(value)

    if (autocomplete && timeZones.length === 1) {
      this.onTimeZoneSet(timeZones[0].name)
    } else {
      this.suggestTimeZones(value)
    }
  }

  onTimeZoneSet(timeZone: string) {
    this.timeZone = timeZone
    this.timezoneRef.element.nativeElement.value = this.tzToStr(timeZone)
    this.suggestTimeZones(null)
  }

  resetTimeZone() {
    this.timezoneRef.element.nativeElement.value = this.tzToStr(this.timeZone)
  }

  suggestTimeZones(value?: string) {
    if (!value) {
      this.timeZoneSuggestions = []
      return
    }
    this.timeZoneSuggestions = this.findTimeZones(value)
      .slice(0, 7)
      .map(x => [ x.name, `${this.tzToStr(x.name)} (${x.rawOffsetInMinutes > 0 ? '+' : ''}${x.rawOffsetInMinutes / 60})` ])
  }

  findTimeZones(value: string) {
    const s = value.toLowerCase().replace(/\s*\/\s*/g, ' ')
    return rawTimeZones.filter(x => this.tzToStr(x.name).replace(/\s*\/\s*/g, ' ').toLowerCase().indexOf(s) !== -1)
  }

  tzToStr(timezone: string) {
    return timezone.replace(/_/g, ' ').replace(/\//g, ' / ')
  }

  strToTz(timezone: string) {
    return timezone.replace(/ \/ /g, '/').replace(/ /g, '_')
  }

  private resuggestDate(from: Date) {
    this.dateSuggestions = Array.from(new Array(7)).map((value, index) => {
      const date = addDays(from, index)
      return [
        date,
        isToday(date) ? 'Today' :
          isTomorrow(date) ? 'Tomorrow' :
            format(date, isThisYear(date) ? weekdayMonthDay : weekdayMonthDayYear)
      ]
    })
  }

  private resuggestTime(from: Date) {
    this.timeSuggestions = Array.from(new Array(7)).map((value, index) => {
      const minutes = this.date.getMinutes()
      let date: Date
      if (minutes !== 0) {
        date = startOfHour(addHours(from, index + 1))
      } else {
        date = addMinutes(addMinutes(startOfHour(this.date), Math.ceil(minutes / 15) * 15), 15 * (index + 1))
      }
      return [date, format(date, hourMinuteAmPm).toLowerCase()]
    })
  }

  private resuggest() {
    this.resuggestDate(this.date)
    this.resuggestTime(this.date)
  }
}
