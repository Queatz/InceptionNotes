import {Component, HostListener, ViewContainerRef} from '@angular/core'
import {Location, LocationStrategy, PathLocationStrategy} from '@angular/common'
import {ActivatedRoute, Router} from '@angular/router'
import {ApiService, Note} from './api.service'
import {UiService} from './ui.service'
import {CollaborationService} from 'app/collaboration.service'
import {SyncService} from 'app/sync.service'
import {Title} from '@angular/platform-browser'
import Util from 'app/util'
import {OpComponent} from './op/op.component';
import {SearchComponent} from './search/search.component';
import {FilterService} from './filter.service';
import {EditInvitationsComponent} from './edit-invitations/edit-invitations.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  host: {'(window:keydown.esc)': 'escapePressed()'},
  providers: [Location, {provide: LocationStrategy, useClass: PathLocationStrategy}]
})
export class AppComponent {

  app: string

  // Double shift to search for IntelliJ users
  private shiftShift?: Date = null

  constructor(
    public api: ApiService,
    public ui: UiService,
    public collaboration: CollaborationService,
    public filter: FilterService,
    public sync: SyncService,
    public view: ViewContainerRef,
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private title: Title
  ) {
    this.ui.registerAppComponent(this)
    this.collaboration.connect()

    route.url.subscribe(url => {
      if (url.length > 0) {
        switch (url[0].path) {
          case 'schedule':
            this.app = 'schedule'
            this.setTitle()
            break
          case 'board':
            this.app = 'board'
            // todo handled by params
            // this.setTitle()
            break
          default:
            this.app = undefined
            // todo handled by params
            // this.setTitle(this.api.getShow())
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

    this.api.onNoteUpdatedObservable.subscribe(noteChange => {
      if (!this.app && noteChange.note === this.api.getShow() && noteChange.property === 'name') {
        this.setTitle(this.api.getShow())
      }
    })
  }

  setTitle(note?: Note) {
    this.title.setTitle(
      this.app === 'schedule' ? 'Schedule' : Util.htmlToText(note?.name, true) || 'Inception Notes'
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

  toggleSideBar(event: MouseEvent) {
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane
  }

  changeView(event: MouseEvent) {
    this.ui.menu([
      {
        title: `${this.appIcon('notes')} Notes`,
        callback: (ctrlKey) => {
          if (event.ctrlKey || ctrlKey) {
            window.open('/', '_blank')
          } else {
            this.router.navigate(['/', 'n', this.api.getEye().id])
          }
        }
      },
      {
        title: `${this.appIcon('schedule')} Schedule`,
        callback: (ctrlKey) => {
          const url = '/schedule'
          if (event.ctrlKey || ctrlKey) {
            window.open(url, '_blank')
          } else {
            this.router.navigateByUrl(url)
          }
        }
      },
      // {
      //   title: `${this.appIcon('board')} Board`,
      //   callback: (ctrlKey) => {
      //     const url = '/board'
      //     if (event.ctrlKey || ctrlKey) {
      //       window.open(url, '_blank')
      //     } else {
      //       this.router.navigateByUrl(url)
      //     }
      //   }
      // }
    ], {x: event.clientX, y: event.clientY})
  }

  appIcon(app: string) {
    switch (app) {
      case 'schedule':
        return '📅'
      case 'board':
        return '📋'
      default:
        return '🟨'
    }
  }

  @HostListener('window:keydown.alt.o', ['$event'])
  showOptions(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    this.ui.dialog({
      view: OpComponent
    })
  }

  @HostListener('window:keydown.alt.s', ['$event'])
  showSearch(event?: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    this.ui.dialog({
      message: 'Search',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val
          dialog.component.instance.ngOnChanges(null)
        })
        dialog.component.instance.onSelection.subscribe(note => {
          this.api.addRecent('search', note.id)
          this.api.setEye(note)
          dialog.back()
        })
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.data.results = results
        })
      },
      ok: result => {
        if (result.data.results && result.data.results.length) {
          this.api.addRecent('search', result.data.results[0].id)
          this.api.setEye(result.data.results[0])
        }
      }
    })
  }

  @HostListener('window:keydown.shift', ['$event'])
  shiftShiftToSearch(event: Event) {
    if (this.shiftShift && (new Date().getTime() - this.shiftShift.getTime()) < 500) {
      this.showSearch()
      this.shiftShift = null
    } else {
      this.shiftShift = new Date()
    }
  }

  @HostListener('window:keydown.alt.f', ['$event'])
  showFilter(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    this.ui.dialog({
      message: 'Filter by links',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.component.instance.recentWhich = 'filter'
        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val
          dialog.component.instance.ngOnChanges(null)
        })
        dialog.component.instance.onSelection.subscribe(note => {
          this.api.addRecent('filter', note.id)
          this.filter.toggleRef(note)
          dialog.back()
        })
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.data.results = results
        })
      },
      ok: result => {
        if (result.data.results && result.data.results.length) {
          this.api.addRecent('filter', result.data.results[0].id)
          this.filter.toggleRef(result.data.results[0])
        }
      }
    })
  }

  isSteward(): boolean {
    return this.collaboration.me()?.isSteward === true
  }

  showInvitations() {
    this.ui.back()
    this.ui.dialog({
      message: 'Invitations',
      view: EditInvitationsComponent
    })
  }
}
