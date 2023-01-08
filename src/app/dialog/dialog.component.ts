import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core'

import {Subject} from 'rxjs'
import {Env} from 'app/ui.service'

export class DialogModel {
  choice: string
  input: string
  data: { [key: string]: any }
}

export class DialogConfig {
  message?: string
  prefill?: string
  input?: boolean
  view?: Type<any>
  init?: (dialog: DialogComponent) => void
  ok?: (model: DialogModel) => void
  cancel?: () => void
}

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
  host: {
    '(click)': 'back()',
    '(keydown.enter)': 'clickOk()',
    '[style.background-color]': 'environment.useDarkTheme ? \'rgba(0, 0, 0, .25)\' : undefined'
  }
})
export class DialogComponent implements OnInit, OnDestroy, AfterViewInit {

  @Input() config: DialogConfig
  @Input() clickout: () => void
  @Input() environment: Env

  @ViewChild('custom', {read: ViewContainerRef, static: true})
  private custom: ViewContainerRef
  component: ComponentRef<any>

  model: DialogModel = {
    choice: null,
    input: '',
    data: {}
  }

  changes: Subject<string> = new Subject<string>()

  constructor(private element: ElementRef,
              private resolver: ComponentFactoryResolver,
              private view: ViewContainerRef) {
  }

  ngOnInit() {
    this.model.input = this.config.prefill || ''

    if (this.config.view) {
      this.component = this.custom.createComponent(this.resolver.resolveComponentFactory(this.config.view))
    }

    if (this.config.init) {
      this.config.init(this)
    }
  }

  ngOnDestroy() {
    if (this.model.choice === null && this.config.cancel) {
      this.config.cancel()
    }

    this.component?.destroy()
  }

  ngAfterViewInit() {
    let first = this.element.nativeElement.querySelector('input')

    if (!first) {
      first = this.element.nativeElement.querySelector('button')
    }

    if (first) {
      first.focus()
    }
  }

  onChanges() {
    this.changes.next(this.model.input)
  }

  onClickInsideDialog(event: Event) {
    event.stopPropagation()
  }

  back() {
    if (this.clickout) {
      this.clickout()
    }
  }

  clickOk() {
    this.model.choice = 'ok'

    if (this.config.ok) {
      this.config.ok(this.model)
    }

    this.back()
  }
}
