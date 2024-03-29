import {Directive, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core'

@Directive({
  selector: '[contenteditableModel]',
  host: {
    '(blur)': 'onBlur()',
    '(keyup)': 'changed()'
  }
})
export class ContenteditableModelDirective implements OnChanges {
  @Input('contenteditableModel') model: string
  @Output('contenteditableModelChange') update = new EventEmitter()

  private lastViewModel: string

  constructor(private elRef: ElementRef) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['model'] && changes['model'].currentValue !== this.lastViewModel) {
      this.lastViewModel = this.model
      this.refreshView()
    }
  }

  onBlur() {
    if (this.elRef.nativeElement.lastChild) {
      if ((this.elRef.nativeElement.lastChild as HTMLElement).tagName === 'BR') {
        (this.elRef.nativeElement.lastChild as HTMLElement).remove()
      }
    }
    if (this.elRef.nativeElement.firstChild) {
      if ((this.elRef.nativeElement.firstChild as HTMLElement).tagName === 'BR') {
        (this.elRef.nativeElement.firstChild as HTMLElement).remove()
      }
    }
    this.changed()
  }

  changed() {
    const value = this.elRef.nativeElement.innerHTML

    if (this.model !== value) {
      this.lastViewModel = this.model = value
      this.update.emit(value)
    }
  }

  private refreshView() {
    this.elRef.nativeElement.innerHTML = this.model
  }
}

