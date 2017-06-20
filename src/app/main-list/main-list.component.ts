import { Component, OnInit } from '@angular/core';
import { ApiService } from '../api.service';

@Component({
  selector: 'main-list',
  templateUrl: './main-list.component.html',
  styleUrls: ['./main-list.component.css'],
  host: { '[style.background-color]': 'api.getEye().color' }
})
export class MainListComponent implements OnInit {

  constructor(public api: ApiService) { }

  ngOnInit() {
    
  }

}
