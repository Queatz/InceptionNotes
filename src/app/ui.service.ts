import {Injectable, ComponentFactoryResolver} from '@angular/core';
import {Subject} from 'rxjs'

import {AppComponent} from './app.component';
import {DialogComponent, DialogConfig} from './dialog/dialog.component';
import {MenuComponent} from './menu/menu.component';

@Injectable()
export class UiService {

  readonly locate = new Subject<any>()

  private appComponent: AppComponent;
  private dialogs = [];
  private lastMenu: Array<MenuStackEntry> = [];

  private env: Env;

  constructor(private resolver: ComponentFactoryResolver) {
  }

  public registerAppComponent(app: AppComponent) {
    this.appComponent = app;
    this.load();
  }

  public back() {
    if (!this.dialogs.length) {
      return false;
    }

    const top = this.dialogs.pop();
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
      dblClickToOpen: false,
      lastBackup: '',
      showDescriptions: false,
      useDarkTheme: false,
      showFlat: false,
      showAsPriorityList: false,
      showSublistPreviews: true,
      showSublistCheckboxes: true,
      showListCheckboxes: false,
      showLinks: true,
      showEstimates: true,
      unlinkOnDelete: false,
      hideDoneItems: false,
      showOnly: 0,
      recentColors: ['#80d8ff', '#ff80ab', '#ffd180', '#E6E3D7', '#ffffff']
    };
  }

  public dialog(config: DialogConfig) {
    const dialog = this.appComponent.view
      .createComponent(this.resolver.resolveComponentFactory(DialogComponent));

    this.dialogs.push(dialog);

    (dialog.instance as DialogComponent).config = config;
    (dialog.instance as DialogComponent).environment = this.env;
    (dialog.instance as DialogComponent).clickout = () => this.back();
  }

  public clearMenus(menuOption?: MenuOption): void {
    const depth = menuOption ? this.lastMenu.findIndex(x => {
      return x.component.options.indexOf(menuOption) !== -1
    }) : -2;

    if (depth === -1) {
      return;
    }

    while (this.lastMenu.length > depth + 1 && !!this.lastMenu.length) {
      const option = this.lastMenu.pop();
      option.component.clickout();
      if (option.parent) {
        option.parent.isOpen = false;
      }
    }
  }

  public menu(options: Array<MenuOption>, position: { x: number, y: number, w?: number }, parentMenuOption?: MenuOption) {
    if (parentMenuOption?.isOpen) {
      return;
    }

    const menu = this.appComponent.view
      .createComponent(this.resolver.resolveComponentFactory(MenuComponent));

    if (this.lastMenu.length && !parentMenuOption) {
      this.lastMenu.pop().component.clickout();
    } else if (parentMenuOption) {
      parentMenuOption.isOpen = true;
    }

    if (parentMenuOption) {
      this.clearMenus(parentMenuOption);
    }

    const component = menu.instance as MenuComponent;

    this.lastMenu.push({
      component,
      parent: parentMenuOption,
      depth: this.lastMenu.length
    } as MenuStackEntry);

    if (!parentMenuOption) {
      position.y += window.scrollY;
    }

    component.options = options;
    component.position = position;
    component.environment = this.env;
    component.clickout = () => menu.hostView.destroy();
  }

  public addRecentColor(color: string) {
    const exists = this.env.recentColors.indexOf(color);

    if (exists !== -1) {
      this.env.recentColors.splice(exists, 1);
    }

    this.env.recentColors.unshift(color);

    if (this.env.recentColors.length > 6) {
      this.env.recentColors.pop();
    }

    this.save();
  }

  public isAnyDialogOpened() {
    return this.dialogs.length > 0;
  }
}

export interface Env {
  sidepane: boolean,
  dblClickToOpen: boolean,
  lastBackup: string,
  showDescriptions: boolean,
  showFlat: boolean,
  useDarkTheme: boolean,
  showAsPriorityList: boolean,
  showSublistPreviews: boolean,
  showSublistCheckboxes: boolean,
  showListCheckboxes: boolean,
  showLinks: boolean,
  showEstimates: boolean,
  unlinkOnDelete: boolean,
  hideDoneItems: boolean,
  showOnly: 0,
  recentColors: Array<string>
}

export interface MenuOption {
  title: string,
  disabled?: boolean,
  callback: () => void,
  shortcut?: string,
  menu?: Array<MenuOption>,

  isOpen?: boolean;
}

interface MenuStackEntry {
  depth: number,
  parent: MenuOption,
  component: MenuComponent
}
