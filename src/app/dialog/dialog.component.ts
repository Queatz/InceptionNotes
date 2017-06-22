import { Component, OnInit, AfterViewInit, Input, ElementRef, ViewChild, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
  host: {
    '(click)': 'back()',
    '(keyup.enter)': 'clickOk()',
    '[style.background-color]': 'environment.useDarkTheme ? \'rgba(0, 0, 0, .25)\' : undefined'
  }
})
export class DialogComponent implements OnInit, AfterViewInit {

  /**
   * message: string
   * input: null | 'some string'
   * ok: () => {}
   */
  @Input() config: any;
  @Input() clickout: any;
  @Input() environment: any;
  
  @ViewChild('custom', { read: ViewContainerRef })
  private custom: ViewContainerRef; 
  
  private model = {
    choice: null,
    input: ''
  };

  constructor(private element: ElementRef,
    private resolver: ComponentFactoryResolver,
    private view: ViewContainerRef) { }

  ngOnInit() {
    this.model.input = this.config.prefill || '';
    
    if (this.config.view) {
      this.custom.createComponent(this.resolver.resolveComponentFactory(this.config.view));
    }
  }
  
  ngAfterViewInit() {
    let first = this.element.nativeElement.querySelector('input');
    if (first) {
      first.focus();
    }
  }
  
  onClickInsideDialog(event: Event) {
    event.stopPropagation();
  }
  
  back() {
    if (this.clickout) {
      this.clickout();
    }
  }
  
  clickOk() {
    this.model.choice = 'ok';
    
    if (this.config.ok) {
      this.config.ok(this.model);
    }
    
    this.back();
  }
}
