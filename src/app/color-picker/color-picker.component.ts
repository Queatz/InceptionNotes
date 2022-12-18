import {Component, ElementRef, EventEmitter, HostListener, OnInit, Output, ViewChild} from '@angular/core'
import {ApiService} from '../api.service'
import {UiService} from '../ui.service'

@Component({
  selector: 'app-color-picker',
  templateUrl: './color-picker.component.html',
  styleUrls: ['./color-picker.component.css']
})
export class ColorPickerComponent implements OnInit {

  colors: string[]
  @Output() onColorSelected = new EventEmitter<string>()
  @Output() onColorConfirmed = new EventEmitter()

  @ViewChild('colorPicker', {static: true})
  colorPickerElement: ElementRef

  private get elements(): Array<HTMLDivElement> {
    return Array.from<ChildNode>(this.colorPickerElement.nativeElement.childNodes)
      .filter(x => x instanceof HTMLDivElement)
      .map(x => x as HTMLDivElement)
  }

  constructor(private api: ApiService, private ui: UiService) {
  }

  ngOnInit() {
    this.colors = this.ui.getEnv().recentColors
  }

  isDark() {
    return this.ui.getEnv().useDarkTheme
  }

  isFlat() {
    return this.ui.getEnv().showFlat
  }

  @HostListener('keydown.arrowLeft')
  left() {
    const indexOfFocused = this.elements.findIndex(element => element === document.activeElement)
    this.elements[indexOfFocused <= 0 ? this.elements.length - 1 : indexOfFocused - 1].focus()
  }

  @HostListener('keydown.arrowRight')
  right() {
    const indexOfFocused = this.elements.findIndex(element => element === document.activeElement)
    this.elements[indexOfFocused === -1 || indexOfFocused >= this.elements.length - 1 ? 0 : indexOfFocused + 1].focus()
  }
}
