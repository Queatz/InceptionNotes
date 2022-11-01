import {Component, OnInit, Input, HostListener, ElementRef, AfterViewInit, HostBinding} from '@angular/core';
import {UiService, MenuOption, Env} from 'app/ui.service';
import Util from 'app/util';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  host: {
    '[style.background-color]': 'environment.useDarkTheme ? \'#606060\' : undefined',
    '[style.color]': 'environment.useDarkTheme ? \'#e0e0e0\' : undefined'
  }
})
export class MenuComponent implements OnInit, AfterViewInit {

  @Input() options: Array<MenuOption>;
  @Input() clickout: () => void;
  @Input() position: { x: number, y: number, w?: number };
  @Input() environment: Env;

  private showing = false;

  constructor(private elementRef: ElementRef, private ui: UiService) {
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.elementRef.nativeElement.querySelectorAll('.menu-option')?.[0]?.focus();
      this.showing = true;
    });
  }

  @HostBinding('style.top')
  get styleTop() {
    let invert = 0;

    if (document.documentElement) {
      if (this.position.y + this.elementRef.nativeElement.offsetHeight - document.documentElement.scrollTop > window.innerHeight) {
        invert = this.elementRef.nativeElement.clientHeight;
      }
    }

    return Math.max(document.documentElement.scrollTop, this.position.y - invert) + 'px';
  }

  @HostBinding('style.left')
  get styleLeft() {
    let invert = 0;

    if (document.documentElement) {
      if (this.position.x + this.elementRef.nativeElement.offsetWidth > document.documentElement.offsetWidth) {
        invert = this.elementRef.nativeElement.offsetWidth + (this.position.w || 0);
      }
    }

    const offset = (this.position.x - invert)
    return (offset < 0 ? document.documentElement.offsetWidth - this.elementRef.nativeElement.offsetWidth : offset) + 'px';
  }

  @HostListener('window:keydown.esc', ['$event'])
  escapePressed(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.back();
  }


  @HostListener('window:mousedown', ['$event'])
  @HostListener('window:contextmenu')
  back(event?: Event) {
    if (event && this.elementRef.nativeElement.contains((<HTMLElement>event.target))) {
      return;
    }

    if (this.showing && this.clickout) {
      this.clickout();
    }
  }

  hovered(event: Event, option: MenuOption) {
    (event.target as HTMLElement).focus();

    if (option.menu) {
      this.ui.menu(option.menu, {
        x: this.elementRef.nativeElement.offsetLeft + this.elementRef.nativeElement.clientWidth,
        y: this.elementRef.nativeElement.offsetTop + (event.target as HTMLElement).offsetTop - Util.convertRemToPixels(.5),
        w: this.elementRef.nativeElement.clientWidth
      }, option)
    } else {
      this.ui.clearMenus(option);
    }
  }

  clicked(event: Event, option: MenuOption) {
    event.stopPropagation();
    option.callback();
    this.clear()
  }

  clear() {
    this.clickout();
    this.ui.clearMenus();
  }
}
