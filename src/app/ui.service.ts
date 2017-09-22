import { Injectable, ComponentFactoryResolver, ViewContainerRef, ComponentFactory } from '@angular/core';

import { AppComponent } from './app.component';
import { DialogComponent } from './dialog/dialog.component';
import { MenuComponent } from './menu/menu.component';

@Injectable()
export class UiService {

  private appComponent: AppComponent;
  private dialogs = [];
  private lastMenu: MenuComponent;

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

    if (!this.env.recentColors) {
      this.env.recentColors = [];
    }
  }

  intro() {
    this.env = {
      sidepane: true,
      dblClickToOpen: true,
      lastBackup: '',
      showDescriptions: true,
      useDarkTheme: false,
      showAsPriorityList: false,
      showSublistPreviews: false,
      recentColors: ['#80d8ff', '#ff80ab', '#ffd180', '#E6E3D7', '#ffffff']
    };
  }

  public dialog(config: any) {
    let dialog = this.appComponent.view
        .createComponent(this.resolver.resolveComponentFactory(DialogComponent));

    this.dialogs.push(dialog);

    (dialog.instance as DialogComponent).config = config;
    (dialog.instance as DialogComponent).environment = this.env;
    (dialog.instance as DialogComponent).clickout = () => this.back();
  }

  public menu(options: Array<string>, position: any, onChooseCallback: any) {
    let menu = this.appComponent.view
        .createComponent(this.resolver.resolveComponentFactory(MenuComponent));

    if (this.lastMenu) {
      this.lastMenu.clickout();
    }

    this.lastMenu = (menu.instance as MenuComponent);

    this.lastMenu.options = options;
    this.lastMenu.position = position;
    this.lastMenu.environment = this.env;
    this.lastMenu.choose = onChooseCallback;
    this.lastMenu.clickout = () => menu.hostView.destroy();
  }
  public addRecentColor(color: string) {
    let exists = this.env.recentColors.indexOf(color);

    if (exists !== -1) {
      this.env.recentColors.splice(exists, 1);
    }

    this.env.recentColors.unshift(color);

    if (this.env.recentColors.length > 6) {
      this.env.recentColors.pop();
    }

    this.save();
  }
}
