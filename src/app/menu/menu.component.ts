import { Component, OnInit, Input, HostListener, ElementRef, ViewContainerRef, AfterViewInit, HostBinding } from '@angular/core';

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

  @Input() options: any;
  @Input() clickout: any;
  @Input() position: any;
  @Input() environment: any;
  @Input() choose: any;
  
  private showing: boolean = false;

  constructor(private view: ViewContainerRef, private elementRef: ElementRef) { }

  ngOnInit() {
  }
  
  ngAfterViewInit() {
    // Prevent inital clicks from closing the menu right away
    setTimeout(() => this.showing = true);
  }
  
  @HostBinding('style.top')
  get styleTop() {
    let invert = 0;
    
    if (document.documentElement) {
      if (this.position.y + this.elementRef.nativeElement.clientHeight > document.documentElement.clientHeight) {
        invert = this.elementRef.nativeElement.clientHeight;
      }
    }
  
    return (this.position.y - invert) + 'px';
  }
  
  @HostBinding('style.left')
  get styleLeft() {
    let invert = 0;
    
    if (document.documentElement) {
      if (this.position.x + this.elementRef.nativeElement.clientWidth > document.documentElement.clientWidth) {
        invert = this.elementRef.nativeElement.clientWidth;
      }
    }
    
    return (this.position.x - invert) + 'px';
  }

  @HostListener('window:keydown.esc', ['$event'])
  escapePressed(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.back();
  }

  @HostListener('window:contextmenu')
  @HostListener('window:click')
  back() {
    if (this.showing && this.clickout) {
      this.clickout();
    }
  }
  
  clicked(option: number) {
    if (this.choose) {
      this.choose(option);
    }
    
    this.clickout();
  }
}
