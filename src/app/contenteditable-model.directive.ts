import { Directive, ElementRef, Input, Output, OnChanges, SimpleChanges, EventEmitter } from '@angular/core';

@Directive({
	selector: '[contenteditableModel]',
	host: {
		'(blur)': 'onBlur()',
		'(keyup)': 'changed()'
	}
})
export class ContenteditableModelDirective implements OnChanges {
	@Input('contenteditableModel') model: any;
	@Output('contenteditableModelChange') update = new EventEmitter();

	private lastViewModel: any;

	constructor(private elRef: ElementRef) {
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['model'] && changes['model'].currentValue !== this.lastViewModel) {
		this.lastViewModel = this.model;
		this.refreshView();
		}
	}

	onBlur() {
		if (this.elRef.nativeElement.lastChild) {
			if ((this.elRef.nativeElement.lastChild as HTMLElement).tagName === 'BR') {
				(this.elRef.nativeElement.lastChild as HTMLElement).remove();
			}
		}
		this.changed();
	}

	changed() {
		let value = this.elRef.nativeElement.innerHTML;
		this.lastViewModel = this.model = value;
		this.update.emit(value);
	}

	private refreshView() {
		this.elRef.nativeElement.innerHTML = this.model;
	}
}

