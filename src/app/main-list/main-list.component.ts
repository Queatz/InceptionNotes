import {Component, HostBinding, Input, OnInit} from '@angular/core'
import {ApiService, Note} from '../api.service'
import {UiService} from 'app/ui.service'

@Component({
  selector: 'main-list',
  templateUrl: './main-list.component.html',
  styleUrls: ['./main-list.component.css'],
  host: {
    '[style.background-color]': 'list ? list.color : null',
    '[style.background-image]': 'ui.getEnv().showFlat ? null : \'-webkit-linear-gradient(right, rgba(255, 255, 255, .25), transparent)\''
  }
})
export class MainListComponent implements OnInit {

  @Input() list?: Note
  @Input() @HostBinding('class.is-showing') show: boolean

  constructor(public api: ApiService, public ui: UiService) {
  }

  ngOnInit() {

  }
}
