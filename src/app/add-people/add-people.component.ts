import {Component, OnDestroy, OnInit} from '@angular/core'
import {Subject} from 'rxjs'
import {VillageService} from 'app/village.service'
import {Person} from '../api.service'

@Component({
  selector: 'app-add-people',
  templateUrl: './add-people.component.html',
  styleUrls: ['./add-people.component.css']
})
export class AddPeopleComponent implements OnInit, OnDestroy {

  onSelection: Subject<Person>

  results: Person[] = []

  constructor(private village: VillageService) {
    this.onSelection = new Subject<Person>()
  }

  ngOnInit() {
    this.search('')
  }

  ngOnDestroy() {
    this.onSelection.complete()
  }

  search(query: string) {
    this.village.friends(query).subscribe(friends => {
      this.results = friends
    })
  }

  select(person: Person) {
    this.onSelection.next(person)
  }
}
