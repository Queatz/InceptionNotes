import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ApiService } from '../api.service';
import { UiService } from '../ui.service';

@Component({
  selector: 'app-color-picker',
  templateUrl: './color-picker.component.html',
  styleUrls: ['./color-picker.component.css']
})
export class ColorPickerComponent implements OnInit {

  colors: any;
  @Output() onColorSelected = new EventEmitter<string>();
  @Output() onColorConfirmed = new EventEmitter();

  constructor(private api: ApiService, private ui: UiService) { }

  ngOnInit() {
    this.colors = this.ui.getEnv().recentColors;
  }

  isDark() {
    return this.ui.getEnv().useDarkTheme;
  }
}
