import { Component, OnInit, Input, OnChanges, SimpleChanges, EventEmitter } from '@angular/core';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnChanges {

    @Input() searchString: string;
    onSelection: EventEmitter<any> = new EventEmitter();
    resultsChanged: EventEmitter<any[]> = new EventEmitter();

    results: any[] = [];

    constructor(private api: ApiService) { }

    ngOnInit() {
    }

    ngOnChanges(changes: SimpleChanges) {
        if (!this.searchString) {
            this.results = [];
            return;
        }

        let all = this.api.getAllNotes();
        let s = this.searchString.toLowerCase();
        this.results = (<any>Object).values(all).filter(n => n.name.toLowerCase().indexOf(s) !== -1);

        if (this.results.length > 10) {
            this.results.length = 10;
        }

        this.resultsChanged.emit(this.results);
    }

    click(note: any) {
        this.onSelection.emit(note);
    }
}
