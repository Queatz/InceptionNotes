import {Injectable} from '@angular/core'
import {HttpClient, HttpHeaders} from '@angular/common/http'
import {BehaviorSubject, filter, map, Observable, tap} from 'rxjs'

import {ApiService, Invitation} from './api.service'
import {UiService} from './ui.service'
import {Config} from 'app/config.service'
import {SyncService} from 'app/sync.service'

@Injectable()
export class CollaborationService {

  private invitation?: Invitation
  private invitationsObservable = new BehaviorSubject<Invitation[]>([])
  private _hasInvitations = false

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
    this.syncService.invitationsChanged.subscribe(() => this.reloadInvitationsAndMe())

    if (this.invitation) {
      this.reloadInvitationsAndMe()
      this.syncService.start()
      return
    }

    this.get('me').subscribe(
      {
        next: (me: Invitation) => {
          this.setMe(me)
          this.reloadInvitations()
          this.syncService.start()
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

  me(): Invitation | null {
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

  hasInvitations() {
    return this._hasInvitations
  }

  connectInvitation(token: string): Observable<Invitation> {
    return this.post<Invitation>('me/invitation', { token }).pipe(
      tap(invitation => {
        this.invitation = invitation
      })
    )
  }

  reloadInvitationsAndMe() {
    this.reloadMe()
    this.reloadInvitations()
  }

  reloadMe() {
    this.get('me').subscribe(
      {
        next: (me: Invitation) => {
          this.setMe(me)
        }
      }
    )
  }

  reloadInvitations() {
    this.get('invitations').subscribe(
      (invitations: Invitation[]) => {
        const i = this.api.refreshInvitations(invitations)
        this._hasInvitations = i.filter(x => x.id !== this.me()?.id).length > 0
        this.invitationsObservable.next(i)
      }
    )
  }

  setName(name: string) {
    this.post<Invitation>('me', {name}).subscribe(me => {
      this.setMe(me)
      this.api.updateInvitation(me)
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

  getNoteInvitations(id: string): Observable<Array<Invitation>> {
    return this.get(`note/${id}/invitations`)
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
