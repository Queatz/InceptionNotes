import {Component, ViewContainerRef} from '@angular/core'
import {Location, LocationStrategy, PathLocationStrategy} from '@angular/common'
import {ActivatedRoute} from '@angular/router'
import {ApiService} from './api.service'
import {UiService} from './ui.service'
import {CollaborationService} from 'app/collaboration.service'
import {SyncService} from 'app/sync.service'
import {Title} from '@angular/platform-browser'
import Util from 'app/util'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  host: {'(window:keydown.esc)': 'escapePressed()'},
  providers: [Location, {provide: LocationStrategy, useClass: PathLocationStrategy}]
})
export class AppComponent {

  viewType: string

  constructor(
    public api: ApiService,
    public ui: UiService,
    public collab: CollaborationService,
    public sync: SyncService,
    public view: ViewContainerRef,
    private location: Location,
    private route: ActivatedRoute,
    private title: Title
  ) {
    this.ui.registerAppComponent(this)
    this.collab.connect()

    route.params.subscribe(params => {
      if (!params['id']) {
        return
      }

      let note = this.api.search(params['id'])

      if (!note) {
        note = this.api.newBlankNote(true, params['id'])
      }

      this.title.setTitle(Util.htmlToText(note.name, true) || 'Inception Notes')

      if (!this.api.getShow() || note.id !== this.api.getShow().id) {
        this.api.setEye(note)
      }
    })
  }

  escapePressed() {
    if (!this.ui.back()) {
      if (!this.viewType) {
        const show = this.api.getShow()
        this.api.up()
        setTimeout(() => {
          this.ui.locate.next({list: show, animate: false})
        })
      }
    }
  }

  changeView() {
    if (this.viewType) {
      this.viewType = undefined
    } else {
      this.viewType = 'schedule'
    }
  }
}
