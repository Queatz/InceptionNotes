import {Component, OnInit} from '@angular/core';
import {CollaborationService} from '../collaboration.service';
import {ActivatedRoute, Router} from '@angular/router';
import {Invitation} from '../api.service';
import {UiService} from '../ui.service';

@Component({
  selector: 'app-accept-invitation',
  templateUrl: './accept-invitation.component.html',
  styleUrls: ['./accept-invitation.component.css']
})
export class AcceptInvitationComponent implements OnInit {

  invitation?: Invitation

  constructor(private ui: UiService, private collaboration: CollaborationService, private route: ActivatedRoute, private router: Router) {
    const me = collaboration.me()

    if (me) {
      this.invitation = me
      this.ui.dialog(
        {
          message: 'This device is already connected to an invitation.  Disconnect in options before connecting another invitation.'
        }
      )
      return
    }

    route.params.subscribe(params => {
      const id = params['id']

      if (!id) {
        return
      }

      this.collaboration.connectInvitation(id).subscribe({
        next: invitation => {
          this.invitation = invitation
        },
        error: err => {
          this.ui.dialog({
            message: `Something went wrong.\n\n${err.message}`
          })
        }
      })
    })
  }

  ngOnInit() {

  }

  goBack() {
    this.router.navigate(['/'])
  }
}
