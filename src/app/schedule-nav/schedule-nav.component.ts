import {Component, EventEmitter, HostBinding, Input, Output} from '@angular/core'
import {ApiService} from '../api.service'
import {UiService} from '../ui.service'

@Component({
  selector: 'app-schedule-nav',
  templateUrl: './schedule-nav.component.html',
  styleUrls: ['./schedule-nav.component.css'],
  host: {
    '[style.background-image]': 'ui.getEnv().showFlat ? null : \'-webkit-linear-gradient(right, rgba(255, 255, 255, .25), transparent)\''
  }
})
export class ScheduleNavComponent {

  @Input() @HostBinding('class.is-showing') show: boolean
  @Input() value: GranularityValue = 'day'
  @Output() valueChange = new EventEmitter<GranularityValue>()

  constructor(public api: ApiService, public ui: UiService) {
  }

  set(value: GranularityValue) {
    this.value = value
    this.valueChange.emit(value)
  }
}

export type GranularityValue = 'year' | 'month' | 'week' | 'day' | 'hour'
