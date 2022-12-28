import {Injectable} from '@angular/core'
import {HttpClient, HttpHeaders} from '@angular/common/http'
import {BehaviorSubject, filter, map, Observable, of, Subject, tap} from 'rxjs'
import {first} from 'rxjs/operators'

import {ApiService, Invitation} from './api.service'
import {UiService} from './ui.service'
import {Config} from 'app/config.service'
import {SyncService} from 'app/sync.service'

@Injectable()
export class CollaborationService {

  private invitation?: Invitation
  private invitationsObservable = new BehaviorSubject<Invitation[]>([])

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
    }
  }

  connect() {
    if (this.invitation) {
      return
    }

    this.get('me').subscribe(
      {
        next: (me: Invitation) => {
          this.setMe(me)
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

  disconnect() {
    this.invitation = null
    localStorage.removeItem('me')
  }

  me() {
    return this.invitation
  }

  getInvitations(k: string = ''): Observable<Invitation[]> {
    k = k.toLowerCase()

    if (!this.invitationsObservable.getValue().length) {
      this.reloadInvitations()
    }

    return this.invitationsObservable.pipe(
      filter(it => !!it.length),
      map(r => r.filter(p => !k || p.name.toLowerCase().indexOf(k) !== -1))
    )
  }

  connectInvitation(token: string): Observable<Invitation> {
    return this.post<Invitation>('me/invitation', { token }).pipe(
      tap(invitation => {
        this.invitation = invitation
      })
    )
  }

  reloadInvitations() {
    this.get('invitations').subscribe(
      (invitations: Invitation[]) => {
        invitations.forEach(p => this.api.updateInvitation(p))
        this.invitationsObservable.next(invitations)
      }
    )
  }

  setName(name: string) {
    this.post<Invitation>('me', {name}).subscribe(result => {
      this.setMe(result)
    })
  }

  private setMe(invitation: Invitation) {
    localStorage.setItem('me', JSON.stringify(invitation))
    this.invitation = invitation
  }

  removeInvitation(invitation: Invitation) {
    this.post(`invitations/${invitation.id}/delete`).subscribe(() => this.reloadInvitations())
  }

  createInvitation(block: (Invitation) => void) {
    this.post(`invitations`).subscribe(invitation => {
      block(invitation)
      this.reloadInvitations()
    })
  }

  makeSteward(invitation: Invitation) {
    this.post(`invitations/${invitation.id}`, { isSteward: true }).subscribe(() => this.reloadInvitations())
  }

  private post<T>(url: string, body?: any): Observable<T> {
    return this.http.post<T>(this.config.getUrl(url), body, this.httpOptions())
  }

  private get<T>(url: string): Observable<T> {
    return this.http.get<T>(this.config.getUrl(url), this.httpOptions())
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
