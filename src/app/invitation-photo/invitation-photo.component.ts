import {Component, Input, OnChanges, SimpleChanges} from '@angular/core'
import {ApiService, Invitation} from '../api.service'

@Component({
  selector: 'app-invitation-photo',
  templateUrl: './invitation-photo.component.html',
  styleUrls: ['./invitation-photo.component.css']
})
export class InvitationPhotoComponent implements OnChanges {

  @Input() invitation!: Invitation
  @Input() small = false
  @Input() inverted = false

  color: string

  constructor(private api: ApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    this.color = this.api.invitationColor(this.invitation.id)
  }
}
