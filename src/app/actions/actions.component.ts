import {Component, HostListener, Input, OnChanges, OnDestroy, OnInit} from '@angular/core'
import {Action, ActionsService} from '../actions.service'
import {Note} from '../api.service'
import {Subject} from 'rxjs'

@Component({
  selector: 'app-actions',
  templateUrl: './actions.component.html',
  styleUrls: ['./actions.component.css']
})
export class ActionsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() searchString = ''

  onSelection: Subject<Action<any>> = new Subject()
  resultsChanged: Subject<Action<any>[]> = new Subject()
  note!: Note
  results: Action<any>[] = []
  resultsHistory: Action<any>[] = []

  constructor(private actions: ActionsService) {
  }

  ngOnInit() {
    this.ngOnChanges()
  }

  ngOnDestroy() {
    this.onSelection.complete()
    this.resultsChanged.complete()
  }

  ngOnChanges() {
    const q = this.searchString.trim().toLowerCase()
    if (q) {
      this.results = this.actions.allActions()
        .filter(x => x.name.toLowerCase().indexOf(q) !== -1)
    } else {
      this.results = this.actions.allActions()
    }
    this.resultsChanged.next(this.results)
    this.resultsHistory = []
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

  select(action: Action<any>) {
    this.onSelection.next(action)
    action.present(this.note)
  }
}
