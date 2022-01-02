import {Component, OnInit, OnDestroy} from '@angular/core';
import {Subject} from 'rxjs';
import {VillageService} from 'app/village.service';

@Component({
  selector: 'app-add-people',
  templateUrl: './add-people.component.html',
  styleUrls: ['./add-people.component.css']
})
export class AddPeopleComponent implements OnInit, OnDestroy {

  onSelection: Subject<any>;

  results: any[] = [];

  constructor(private village: VillageService) {
    this.onSelection = new Subject<any>();
  }

  ngOnInit() {
    this.search('');
  }

  ngOnDestroy() {
    this.onSelection.complete();
  }

  search(query: string) {
    this.village.friends(query).subscribe(friends => {
      this.results = friends;
    });
  }

  select(person: any) {
    this.onSelection.next(person);
  }
}
