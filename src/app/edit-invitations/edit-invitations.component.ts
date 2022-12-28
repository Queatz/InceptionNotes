import {Component, OnInit} from '@angular/core'
import {UiService} from '../ui.service'
import {ApiService, Invitation} from '../api.service'
import {CollaborationService} from '../collaboration.service'
import {Config} from '../config.service';

@Component({
  selector: 'app-edit-invitations',
  templateUrl: './edit-invitations.component.html',
  styleUrls: ['./edit-invitations.component.css']
})
export class EditInvitationsComponent implements OnInit {

  invitations: Invitation[] = []

  constructor(
    private ui: UiService,
    private api: ApiService,
    private collaboration: CollaborationService,
    private config: Config
  ) {
  }

  ngOnInit() {
    this.collaboration.getInvitations().subscribe(
      invitations => this.invitations = invitations
    )
  }

  addNew() {
    this.collaboration.createInvitation(invitation => {
      this.showLink(invitation)
    })
  }

  select(event: MouseEvent, invitation: Invitation) {
    this.ui.menu([
      {
        title: 'Get link',
        callback: () => {
          this.showLink(invitation)
        }
      },
      ...(invitation.isSteward ? [] : [
        {
          title: 'Make steward',
          callback: () => {
            this.ui.dialog(
              {
                message: 'Make steward?\n\nDevices using this invitation will be able to add and remove invitations, but not other stewards.',
                ok: () => {
                  this.collaboration.makeSteward(invitation)
                }
              }
            )
          }
        },
        {
          title: 'Remove',
          callback: () => {
            this.ui.dialog(
              {
                message: 'Remove this invitation?',
                ok: () => {
                  this.collaboration.removeInvitation(invitation)
                }
              }
            )
          }
        }
      ])
    ], {x: event.clientX, y: event.clientY})
  }

  private showLink(invitation: Invitation) {
    this.ui.dialog({
      message: invitation.token ? `Share this link\n\n${this.config.invitationLink(invitation.token)}` : 'No link available'
    })
  }
}
