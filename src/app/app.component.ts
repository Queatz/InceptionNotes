import {Component, ViewContainerRef} from '@angular/core'
import {Location, LocationStrategy, PathLocationStrategy} from '@angular/common'
import {ActivatedRoute, Router} from '@angular/router'
import {ApiService, Note} from './api.service'
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

  app: string

  constructor(
    public api: ApiService,
    public ui: UiService,
    public collab: CollaborationService,
    public sync: SyncService,
    public view: ViewContainerRef,
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private title: Title
  ) {
    this.ui.registerAppComponent(this)
    this.collab.connect()

    route.url.subscribe(url => {
      if (url.length > 0) {
        switch (url[0].path) {
          case 'schedule':
            this.app = 'schedule'
            this.setTitle()
            break
          default:
            this.app = undefined
            this.setTitle(this.api.getEye())
            break
        }
      }
    })

    route.params.subscribe(params => {
      if (!params['id']) {
        return
      }

      let note = this.api.search(params['id'])

      if (!note) {
        note = this.api.newBlankNote(true, params['id'])
      }

      this.setTitle(note)

      if (!this.api.getShow() || note.id !== this.api.getShow().id) {
        this.api.setEye(note)
      }
    })
  }

  setTitle(note?: Note) {
    this.title.setTitle(
      this.app === 'schedule' ? 'Schedule' : Util.htmlToText(note.name, true) || 'Inception Notes'
    )
  }

  escapePressed() {
    if (!this.ui.back()) {
      if (!this.app) {
        const show = this.api.getShow()
        this.api.up()
        setTimeout(() => {
          this.ui.locate.next({list: show, animate: false})
        })
      }
    }
  }

  changeView(event: MouseEvent) {
    this.ui.menu([
      {
        title: 'Notes',
        callback: (ctrlKey) => {
          if (event.ctrlKey || ctrlKey) {
            window.open('/', '_blank')
          } else {
            this.router.navigate(['/', 'n', this.api.getEye().id])
          }
        }
      }, {
        title: 'Schedule',
        callback: (ctrlKey) => {
          const url = '/schedule'
          if (event.ctrlKey || ctrlKey) {
            window.open(url, '_blank')
          } else {
            this.router.navigateByUrl(url)
          }
        }
      }
    ], { x: event.clientX, y: event.clientY })
  }
}
