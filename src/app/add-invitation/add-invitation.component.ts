import {Component, OnDestroy, OnInit} from '@angular/core'
import {Subject} from 'rxjs'
import {CollaborationService} from 'app/collaboration.service'
import {Invitation} from '../api.service'

@Component({
  selector: 'app-add-invitation',
  templateUrl: './add-invitation.component.html',
  styleUrls: ['./add-invitation.component.css']
})
export class AddInvitationComponent implements OnInit, OnDestroy {

  onSelection: Subject<Invitation>

  results: Invitation[] = []

  constructor(private village: CollaborationService) {
    this.onSelection = new Subject<Invitation>()
  }

  ngOnInit() {
    this.search('')
  }

  ngOnDestroy() {
    this.onSelection.complete()
  }

  search(query: string) {
    this.village.getInvitations(query).subscribe(friends => {
      this.results = friends
    })
  }

  select(invitation: Invitation) {
    this.onSelection.next(invitation)
  }
}
