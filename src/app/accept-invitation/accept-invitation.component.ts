import {Component, OnInit} from '@angular/core'
import {CollaborationService} from '../sync/collaboration.service'
import {ActivatedRoute, Router} from '@angular/router'
import {Invitation} from '../api.service'

@Component({
  selector: 'app-accept-invitation',
  templateUrl: './accept-invitation.component.html',
  styleUrls: ['./accept-invitation.component.css']
})
export class AcceptInvitationComponent implements OnInit {

  loading = false
  invitation?: Invitation
  message?: string

  constructor(private collaboration: CollaborationService, private route: ActivatedRoute, private router: Router) {
  }

  ngOnInit() {
    const me = this.collaboration.me()

    if (me) {
      this.invitation = me
      this.message = 'This device is already connected to an invitation.  Disconnect in options before connecting another invitation.'
      return
    }

    this.route.params.subscribe(params => {
      const id = params['id']

      if (!id) {
        return
      }

      this.loading = true
      this.collaboration.connectInvitation(id).subscribe({
        next: invitation => {
          this.loading = false
          this.invitation = invitation
        },
        error: err => {
          this.loading = false
          this.message = err.statusText || 'Something went wrong.'
        }
      })
    })
  }

  goBack() {
    this.router.navigate(['/'])
  }
}
