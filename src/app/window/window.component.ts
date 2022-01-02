import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-window',
  template: '<router-outlet></router-outlet>'
})
export class WindowComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }
}
