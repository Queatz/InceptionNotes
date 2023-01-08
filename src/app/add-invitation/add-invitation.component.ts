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

  constructor(private collaboration: CollaborationService) {
    this.onSelection = new Subject<Invitation>()
  }

  ngOnInit() {
    this.search('')
  }

  ngOnDestroy() {
    this.onSelection.complete()
  }

  search(query: string) {
    this.collaboration.getInvitations(query).subscribe(invitations => {
      const meId = this.collaboration.me()?.id
      this.results = invitations.filter(x => x.id !== meId)
    })
  }

  select(invitation: Invitation) {
    this.onSelection.next(invitation)
  }
}
