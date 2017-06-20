import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { MainListComponent } from './main-list/main-list.component';
import { MainDeskComponent } from './main-desk/main-desk.component';
import { ApiService } from './api.service';
import { UiService } from './ui.service';
import { SubListComponent } from './sub-list/sub-list.component';
import { ContenteditableModelDirective } from './contenteditable-model.directive';
import { DialogComponent } from './dialog/dialog.component';

@NgModule({
  declarations: [
    AppComponent,
    MainListComponent,
    MainDeskComponent,
    SubListComponent,
    ContenteditableModelDirective,
    DialogComponent
  ],
  entryComponents: [DialogComponent],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [
    ApiService,
    UiService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
