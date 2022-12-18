import {Component, HostListener, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core'
import {ApiService, Note} from '../api.service'
import {Subject} from 'rxjs'

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnChanges {

  @Input() searchString: string
  @Input() recentWhich = 'search'
  onSelection: Subject<Note> = new Subject()
  resultsChanged: Subject<Note[]> = new Subject()

  resultsHistory: Note[] = []
  results: Note[] = []

  constructor(private api: ApiService) {
  }

  ngOnInit() {
    this.api.getRecent(this.recentWhich).forEach(n => this.results.push(n))
    this.resultsChanged.next(this.results)
  }

  @HostListener('window:keydown.arrowDown')
  down() {
    if (this.results.length > 1) {
      this.resultsHistory.push(this.results.shift())
      this.resultsChanged.next(this.results)
    }

    return false
  }

  @HostListener('window:keydown.arrowUp')
  up() {
    if (this.resultsHistory.length) {
      this.results.unshift(this.resultsHistory.pop())
      this.resultsChanged.next(this.results)
    }

    return false
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.searchString) {
      this.results = []
      return
    }

    const all = this.api.getAllNotes()
    const s = this.searchString.trim().toLowerCase()
    this.results = [...all.values()].filter(n => n.name.toLowerCase().indexOf(s) !== -1)

    if (this.results.length > 50) {
      this.results.length = 50
    }

    this.resultsHistory = []

    this.resultsChanged.next(this.results)
  }

  click(note: Note) {
    this.api.addRecent(this.recentWhich, note.id)
    this.onSelection.next(note)
  }
}
