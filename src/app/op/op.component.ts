import {Component, OnInit} from '@angular/core'
import {Env, UiService} from '../ui.service'
import {ApiService} from '../api.service'
import {CollaborationService} from '../collaboration.service'
import {EditInvitationsComponent} from '../edit-invitations/edit-invitations.component';

@Component({
  selector: 'app-options',
  templateUrl: './op.component.html',
  styleUrls: ['./op.component.css']
})
export class OpComponent implements OnInit {

  env: Env

  constructor(private ui: UiService, private api: ApiService, private collaboration: CollaborationService) {
    this.env = this.ui.getEnv()
  }

  ngOnInit() {

  }

  update() {
    this.ui.save()
  }

  me() {
    return this.collaboration.me()
  }

  name(): string {
    return this.collaboration.me()?.name
  }

  isSteward(): boolean {
    return this.collaboration.me()?.isSteward === true
  }

  disconnectSync() {
    this.ui.dialog({
      message: 'Disconnect from this invitation?\n\nAll existing notes will remain on your machine in offline mode. You will need an active invitation link to collaborate again.',
      ok: () => {
        this.collaboration.disconnect()
      }
    })
  }

  backup() {
    this.api.backup()
  }

  unbackup() {
    this.api.unbackup()
  }

  showInvitationsModal() {
    this.ui.back()
    this.ui.dialog({
      message: 'Invitations',
      view: EditInvitationsComponent
    })
  }

  changeName() {
    this.ui.dialog({
      message: 'Set name',
      input: true,
      prefill: this.name() ?? '',
      ok: result => {
        this.collaboration.setName(result.input)
      }
    })
  }
}
