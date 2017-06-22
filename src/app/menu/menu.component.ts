import { Component, OnInit, Input, HostListener, ViewContainerRef, AfterViewInit, HostBinding } from '@angular/core';

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

  constructor(private view: ViewContainerRef) { }

  ngOnInit() {
  }
  
  ngAfterViewInit() {
    // Prevent inital clicks from closing the menu right away
    setTimeout(() => this.showing = true);
  }
  
  @HostBinding('style.top')
  get styleTop() {
    return this.position.y + 'px';
  }
  
  @HostBinding('style.left')
  get styleLeft() {
    return this.position.x + 'px';
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
