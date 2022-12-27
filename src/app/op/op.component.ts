import {Component, OnInit} from '@angular/core'
import {Env, UiService} from '../ui.service'
import {ApiService} from '../api.service'
import {CollaborationService} from '../collaboration.service'
import {Config} from 'app/config.service'

@Component({
  selector: 'app-options',
  templateUrl: './op.component.html',
  styleUrls: ['./op.component.css']
})
export class OpComponent implements OnInit {

  env: Env

  constructor(private ui: UiService, private api: ApiService, private village: CollaborationService, private config: Config) {
    this.env = this.ui.getEnv()
  }

  ngOnInit() {

  }

  update() {
    this.ui.save()
  }

  isSyncConnected() {
    return !!this.village.me()
  }

  disconnectSync() {
    this.village.disconnect()
  }

  backup() {
    this.api.backup()
  }

  unbackup() {
    this.api.unbackup()
  }

  showInvitationsModal() {
  }
}
