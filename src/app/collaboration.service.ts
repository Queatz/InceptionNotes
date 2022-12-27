import {Injectable} from '@angular/core'
import {HttpClient, HttpHeaders} from '@angular/common/http'
import {map, Observable, of, Subject} from 'rxjs'
import {first} from 'rxjs/operators'

import {ApiService, FrozenNote, Invitation} from './api.service'
import {UiService} from './ui.service'
import {Config} from 'app/config.service'
import {SyncService} from 'app/sync.service'

export class InvitationServerModel {
  invitation?: Invitation
  notes?: Array<FrozenNote>
}

@Injectable()
export class CollaborationService {

  private invitation?: Invitation
  private invitationsObservable: Subject<Invitation[]> = new Subject()
  private invitations: Invitation[] = []

  constructor(
    private http: HttpClient,
    private config: Config,
    private api: ApiService,
    private ui: UiService,
    private syncService: SyncService
  ) {
    const local = JSON.parse(localStorage.getItem('me')) as Invitation

    if (local) {
      this.invitation = local
      this.syncService.setInvitation(this.invitation)
    }
  }

  public connect() {
    if (this.invitation) {
      return
    }

    this.http.get(this.config.getUrl('me'), this.httpOptions()).subscribe(
      {
        next: (me: Invitation) => {
          this.invitation = me
          this.syncService.setInvitation(me)
        },
        error: err => {
          if (err.status === 404) {
            this.ui.dialog(
              {
                message: 'No invitation to collaborate was found.'
              }
            )
          } else {
            this.ui.dialog(
              {
                message: `There was an error syncing.\n\n${err.message}`
              }
            )
          }
        }
      }
    )
  }

  public disconnect() {
    this.invitation = null
    localStorage.removeItem('me')
  }

  public me() {
    return this.invitation
  }

  public getInvitations(k: string): Observable<Invitation[]> {
    k = k.toLowerCase()

    let result: Observable<Invitation[]>

    if (this.invitations) {
      result = of(this.invitations)
    } else {
      result = this.invitationsObservable
      this.http.get(this.config.getUrl('invitations'), this.httpOptions()).subscribe(
        (invitations: Invitation[]) => {
          this.invitations = invitations
          this.invitations.forEach(p => this.api.updateInvitation(p))
          this.invitationsObservable.next(this.invitations)
        }
      )
    }

    return result.pipe(
      first(),
      map(r => r.filter(p => !k || p.name.toLowerCase().indexOf(k) !== -1))
    )
  }

  private httpOptions() {
    return {
      headers: new HttpHeaders(
        {
          'Authorization': `Bearer ${this.syncService.deviceToken()}`,
          'Content-Type': 'application/json;charset=utf-8'
        }
      )
    }
  }
}
