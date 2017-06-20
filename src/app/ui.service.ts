import { Injectable, ComponentFactoryResolver, ViewContainerRef, ComponentFactory } from '@angular/core';

import { AppComponent } from './app.component';
import { DialogComponent } from './dialog/dialog.component';

@Injectable()
export class UiService {

  private appComponent: AppComponent;
  private dialogs = [];

  constructor(private resolver: ComponentFactoryResolver) { }

  public registerAppComponent(app: AppComponent) {
    this.appComponent = app;
  }

  private env = {
    sidepane: true
  };
  
  public back() {
    if (!this.dialogs.length) {
      return false;
    }
    
    let top = this.dialogs.pop();
    top.hostView.destroy();
    
    return true;
  }
  
  public getEnv() {
    return this.env;
  }
  
  public setEnv() {
    return this.env;
  }
  
  public dialog(config: any) {
    let dialog = this.appComponent.view
        .createComponent(this.resolver.resolveComponentFactory(DialogComponent));
        
    this.dialogs.push(dialog);
    
    (dialog.instance as DialogComponent).config = config;
    (dialog.instance as DialogComponent).clickout = () => this.back();
  }
}
