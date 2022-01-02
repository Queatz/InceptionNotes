import {Component, OnInit, Input, HostBinding} from '@angular/core';
import {ApiService} from '../api.service';
import {UiService} from 'app/ui.service';

@Component({
  selector: 'main-list',
  templateUrl: './main-list.component.html',
  styleUrls: ['./main-list.component.css'],
  host: {'[style.background-color]': 'api.getEye().color'}
})
export class MainListComponent implements OnInit {

  @Input() @HostBinding('class.is-showing') show: boolean;

  constructor(public api: ApiService, public ui: UiService) {
  }

  ngOnInit() {

  }
}
