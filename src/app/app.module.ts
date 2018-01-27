import { BrowserModule } from '@angular/platform-browser';
import { NgModule, enableProdMode } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app.component';
import { MainListComponent } from './main-list/main-list.component';
import { MainDeskComponent } from './main-desk/main-desk.component';
import { ApiService } from './api.service';
import { UiService } from './ui.service';
import { VillageService } from './village.service';
import { CollaborateService } from './collaborate.service';
import { SubListComponent } from './sub-list/sub-list.component';
import { ContenteditableModelDirective } from './contenteditable-model.directive';
import { DialogComponent } from './dialog/dialog.component';
import { SubSubListItemComponent } from './sub-sub-list-item/sub-sub-list-item.component';
import { OpComponent } from './op/op.component';
import { MenuComponent } from './menu/menu.component';
import { ColorPickerComponent } from './color-picker/color-picker.component';
import { DiffComponent } from './diff/diff.component';
import { SearchComponent } from './search/search.component';
import { SyncService } from 'app/sync.service';
import { WsService } from 'app/ws.service';
import { Config } from 'app/config.service';
import { AddPeopleComponent } from './add-people/add-people.component';

enableProdMode();

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
    DiffComponent,
    SearchComponent,
    AddPeopleComponent
  ],
  entryComponents: [
    DialogComponent,
    OpComponent,
    MenuComponent,
    ColorPickerComponent,
    SearchComponent,
    AddPeopleComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    RouterModule,
    HttpModule,
  ],
  providers: [
    ApiService,
    UiService,
    VillageService,
    CollaborateService,
    SyncService,
    WsService,
    Config
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
