import {Component, OnInit, Input, HostBinding} from '@angular/core';
import {ApiService} from '../api.service';
import {UiService} from 'app/ui.service';

@Component({
  selector: 'main-list',
  templateUrl: './main-list.component.html',
  styleUrls: ['./main-list.component.css'],
  host: {
    '[style.background-color]': 'api.getEye().color',
    '[style.background-image]': 'ui.getEnv().showFlat ? null : \'-webkit-linear-gradient(right, rgba(255, 255, 255, .25), transparent)\''
  }
})
export class MainListComponent implements OnInit {

  @Input() @HostBinding('class.is-showing') show: boolean;

  constructor(public api: ApiService, public ui: UiService) {
  }

  ngOnInit() {

  }
}
