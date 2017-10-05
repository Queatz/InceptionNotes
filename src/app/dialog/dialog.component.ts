import { Component, OnInit, OnDestroy, AfterViewInit, Input, EventEmitter, ElementRef, ViewChild, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';

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
export class DialogComponent implements OnInit, OnDestroy, AfterViewInit {

  /**
   * message: string
   * input: null | 'some string'
   * ok: () => {}
   * init: dialog => {}
   */
  @Input() config: any;
  @Input() clickout: any;
  @Input() environment: any;

  @ViewChild('custom', { read: ViewContainerRef })
  private custom: ViewContainerRef;
  private component: any;

  private model = {
    choice: null,
    input: ''
  };

  changes: EventEmitter<string> = new EventEmitter();

  constructor(private element: ElementRef,
    private resolver: ComponentFactoryResolver,
    private view: ViewContainerRef) { }

  ngOnInit() {
    this.model.input = this.config.prefill || '';

    if (this.config.view) {
      this.component = this.custom.createComponent(this.resolver.resolveComponentFactory(this.config.view));
    }
  }

  ngOnDestroy() {
    if (this.model.choice === null && this.config.cancel) {
      this.config.cancel();
    }
  }

  ngAfterViewInit() {
    let first = this.element.nativeElement.querySelector('input');

    if (!first) {
      first = this.element.nativeElement.querySelector('button');
    }

    if (first) {
      first.focus();
    }

    if (this.config.init) {
      this.config.init(this);
    }
  }

  onChanges() {
    this.changes.emit(this.model.input);
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
