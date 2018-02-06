import { Component, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { Location, LocationStrategy, PathLocationStrategy, PopStateEvent } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from './api.service';
import { UiService } from './ui.service';
import { VillageService } from 'app/village.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  host: { '(window:keydown.esc)': 'escapePressed($event)' },
  providers: [Location, {provide: LocationStrategy, useClass: PathLocationStrategy}]
})
export class AppComponent {
  constructor(
      public api: ApiService,
      public ui: UiService,
      public village: VillageService,
      public view: ViewContainerRef,
      public resolver: ComponentFactoryResolver,
      private location: Location,
      private route: ActivatedRoute
  ) {
    this.ui.registerAppComponent(this);
    this.village.check();

    route.params.subscribe(params => {
      if (!params['id']) {
        return;
      }
      
      let note = this.api.search(params['id']);

      if (note) {
        if (!this.api.getShow() || note.id !== this.api.getShow().id) {
          this.api.setEye(note);
        }
      } else {
        this.ui.dialog({
          message: 'The note was not found'
        });
      }
    })
  }

  escapePressed(event: any) {
    if (!this.ui.back()) {
      this.api.up();
    }
  }

  getEnv() {
    return this.ui.getEnv();
  }
}
