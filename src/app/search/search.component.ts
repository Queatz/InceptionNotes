import { Component, OnInit, Input, OnChanges, SimpleChanges, EventEmitter, HostListener } from '@angular/core';
import { ApiService } from '../api.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnChanges {

    @Input() searchString: string;
    onSelection: Subject<any> = new Subject();
    resultsChanged: Subject<any[]> = new Subject();

    resultsHistory: any[] = [];
    results: any[] = [];

    constructor(private api: ApiService) { }

    ngOnInit() {
        this.api.getRecent('search').forEach(n => this.results.push(n));
        this.resultsChanged.next(this.results);
    }

    @HostListener('window:keydown.arrowdown')
    down() {
        if (this.results.length > 1) {
            this.resultsHistory.push(this.results.shift());
            this.resultsChanged.next(this.results);
        }

        return false;
    }

    @HostListener('window:keydown.arrowup')
    up() {
        if (this.resultsHistory.length) {
            this.results.unshift(this.resultsHistory.pop());
            this.resultsChanged.next(this.results);
        }

        return false;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (!this.searchString) {
            this.results = [];
            return;
        }

        let all = this.api.getAllNotes();
        let s = this.searchString.trim().toLowerCase();
        this.results = (<any>Object).values(all).filter(n => n.name.toLowerCase().indexOf(s) !== -1);

        this.resultsHistory = [];

        this.resultsChanged.next(this.results);
    }

    click(note: any) {
        this.api.addRecent('search', note.id);
        this.onSelection.next(note);
    }
}
