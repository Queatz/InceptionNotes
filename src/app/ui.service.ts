import { Injectable, ComponentFactoryResolver, ViewContainerRef, ComponentFactory } from '@angular/core';

import { AppComponent } from './app.component';
import { DialogComponent } from './dialog/dialog.component';
import { MenuComponent } from './menu/menu.component';

@Injectable()
export class UiService {

  private appComponent: AppComponent;
  private dialogs = [];

  constructor(private resolver: ComponentFactoryResolver) { }

  public registerAppComponent(app: AppComponent) {
    this.appComponent = app;
    this.load();
  }

  private env: any;
  
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

  public save() {
    localStorage.setItem('env', JSON.stringify(this.env));
  }

  public load() {
    this.env = JSON.parse(localStorage.getItem('env'));
    
    if (!this.env) {
      this.intro();
    }
  }
  
  intro() {
    this.env = {
      sidepane: true,
      dblClickToOpen: true,
      lastBackup: '',
      showDescriptions: true,
      useDarkTheme: false
    };
  }
  
  public dialog(config: any) {
    let dialog = this.appComponent.view
        .createComponent(this.resolver.resolveComponentFactory(DialogComponent));
        
    this.dialogs.push(dialog);
    
    (dialog.instance as DialogComponent).config = config;
    (dialog.instance as DialogComponent).clickout = () => this.back();
  }
  
  public menu(options: Array<string>, position: any, onChooseCallback: any) {
    let menu = this.appComponent.view
        .createComponent(this.resolver.resolveComponentFactory(MenuComponent));
    
    (menu.instance as MenuComponent).options = options;
    (menu.instance as MenuComponent).position = position;
    (menu.instance as MenuComponent).environment = this.env;
    (menu.instance as MenuComponent).choose = onChooseCallback;
    (menu.instance as MenuComponent).clickout = () => menu.hostView.destroy();
  }
}
