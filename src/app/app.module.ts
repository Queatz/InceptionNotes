import {BrowserModule} from '@angular/platform-browser'
import {enableProdMode, NgModule} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {HttpClientModule} from '@angular/common/http'

import {AppComponent} from './app.component'
import {MainListComponent} from './main-list/main-list.component'
import {MainDeskComponent} from './main-desk/main-desk.component'
import {ApiService} from './api.service'
import {UiService} from './ui.service'
import {CollaborationService} from './sync/collaboration.service'
import {SubListComponent} from './sub-list/sub-list.component'
import {ContenteditableModelDirective} from './contenteditable-model.directive'
import {DialogComponent} from './dialog/dialog.component'
import {SubSubListItemComponent} from './sub-sub-list-item/sub-sub-list-item.component'
import {OpComponent} from './op/op.component'
import {MenuComponent} from './menu/menu.component'
import {ColorPickerComponent} from './color-picker/color-picker.component'
import {SearchComponent} from './search/search.component'
import {SyncService} from 'app/sync/sync.service'
import {WsService} from 'app/sync/ws.service'
import {Config} from 'app/config.service'
import {AddInvitationComponent} from './add-invitation/add-invitation.component'
import {AppRoutingModule} from './app.routes'
import {WindowComponent} from './window/window.component'
import {FilterService} from './filter.service'
import { EditInvitationsComponent } from './edit-invitations/edit-invitations.component'
import { AcceptInvitationComponent } from './accept-invitation/accept-invitation.component'
import { InvitationPhotoComponent } from './invitation-photo/invitation-photo.component'
import { ScheduleComponent } from './schedule/schedule.component'
import { ScrollableAreaComponent } from './scrollable-area/scrollable-area.component'
import { ActionsComponent } from './actions/actions.component'
import { ScheduleNoteComponent } from './schedule-note/schedule-note.component'
import { ScheduleNavComponent } from './schedule-nav/schedule-nav.component'
import { FilterBoxComponent } from './filter-box/filter-box.component'

enableProdMode()

@NgModule({
  declarations: [
    AppComponent,
    MainListComponent,
    MainDeskComponent,
    SubListComponent,
    ContenteditableModelDirective,
    DialogComponent,
    SubSubListItemComponent,
    OpComponent,
    MenuComponent,
    ColorPickerComponent,
    SearchComponent,
    AddInvitationComponent,
    WindowComponent,
    EditInvitationsComponent,
    AcceptInvitationComponent,
    InvitationPhotoComponent,
    ScheduleComponent,
    ScrollableAreaComponent,
    ActionsComponent,
    ScheduleNoteComponent,
    ScheduleNavComponent,
    FilterBoxComponent
  ],
    imports: [
        BrowserModule,
        FormsModule,
        HttpClientModule,
        AppRoutingModule,
    ],
  providers: [
    ApiService,
    FilterService,
    UiService,
    CollaborationService,
    SyncService,
    WsService,
    Config
  ],
  bootstrap: [WindowComponent]
})
export class AppModule {
}
