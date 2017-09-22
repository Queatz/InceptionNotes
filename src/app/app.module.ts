import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { MainListComponent } from './main-list/main-list.component';
import { MainDeskComponent } from './main-desk/main-desk.component';
import { ApiService } from './api.service';
import { UiService } from './ui.service';
import { VillageService } from './village.service';
import { SubListComponent } from './sub-list/sub-list.component';
import { ContenteditableModelDirective } from './contenteditable-model.directive';
import { DialogComponent } from './dialog/dialog.component';
import { SubSubListItemComponent } from './sub-sub-list-item/sub-sub-list-item.component';
import { OpComponent } from './op/op.component';
import { MenuComponent } from './menu/menu.component';
import { ColorPickerComponent } from './color-picker/color-picker.component';

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
    ColorPickerComponent
  ],
  entryComponents: [
    DialogComponent,
    OpComponent,
    MenuComponent,
    ColorPickerComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    RouterModule
  ],
  providers: [
    ApiService,
    UiService,
    VillageService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
