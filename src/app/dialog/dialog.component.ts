import { Component, OnInit, AfterViewInit, Input, ElementRef } from '@angular/core';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
  host: { '(click)': 'back()'}
})
export class DialogComponent implements OnInit, AfterViewInit {

  /**
   * message: string
   * input: null | 'some string'
   * ok: () => {}
   */
  @Input() config: any;
  @Input() clickout: any;
  
  private model = {
    choice: null,
    input: ''
  };

  constructor(private element: ElementRef) { }

  ngOnInit() {
    this.model.input = this.config.prefill || '';
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
