import {ComponentRef, Injectable} from '@angular/core'
import {Subject} from 'rxjs'

import {AppComponent} from './app.component'
import {DialogComponent, DialogConfig} from './dialog/dialog.component'
import {MenuComponent} from './menu/menu.component'
import {Invitation, Note} from './api.service'

export const recentsLength = 5

@Injectable()
export class UiService {

  readonly locate = new Subject<{ list: Note, animate?: boolean }>()

  private appComponent: AppComponent
  private dialogs: Array<ComponentRef<DialogComponent>> = []
  private lastMenu: Array<MenuStackEntry> = []

  private env: Env

  constructor() {
  }

  registerAppComponent(app: AppComponent) {
    this.appComponent = app
    this.load()
  }

  back() {
    if (!this.dialogs.length) {
      return false
    }

    const top = this.dialogs.pop()
    top.hostView.destroy()

    return true
  }

  remove(dialog: ComponentRef<DialogComponent>) {
    const index = this.dialogs.indexOf(dialog)

    if (index === -1) {
      return false
    }

    const top = this.dialogs.splice(index, 1).pop()
    top.hostView.destroy()

    return true
  }

  getEnv() {
    return this.env
  }

  save() {
    localStorage.setItem('env', JSON.stringify(this.env))
  }

  load() {
    this.env = JSON.parse(localStorage.getItem('env'))

    if (!this.env) {
      this.intro()
    }

    if (!this.env.recentColors) {
      this.env.recentColors = []
    }

    if (!this.env.recentDates) {
      this.env.recentDates = []
    }
  }

  intro() {
    this.env = {
      sidepane: true,
      dblClickToOpen: false,
      lastBackup: '',
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
      expandedNav: false,
      showEmptiness: false,
      showOnly: 0,
      syncInterval: 500,
      recentColors: ['#80d8ff', '#ff80ab', '#ffd180', '#E6E3D7', '#ffffff'],
      recentDates: []
    }
  }

  dialog(config: DialogConfig) {
    const dialog = this.appComponent.view
      .createComponent(DialogComponent)

    this.dialogs.push(dialog)

    dialog.instance.config = config
    dialog.instance.environment = this.env
    dialog.instance.clickout = () => this.remove(dialog)
  }

  clearMenus(menuOption?: MenuOption): void {
    const depth = menuOption ? this.lastMenu.findIndex(x => {
      return x.component.options.indexOf(menuOption) !== -1
    }) : -2

    if (depth === -1) {
      return
    }

    while (this.lastMenu.length > depth + 1 && !!this.lastMenu.length) {
      const option = this.lastMenu.pop()
      option.component.clickout()
      if (option.parent) {
        option.parent.isOpen = false
      }
    }
  }

  menu(options: Array<MenuOption>, position: { x: number, y: number, w?: number }, parentMenuOption?: MenuOption) {
    if (parentMenuOption?.isOpen) {
      return
    }

    const menu = this.appComponent.view.createComponent(MenuComponent)

    if (this.lastMenu.length && !parentMenuOption) {
      this.lastMenu.pop().component.clickout()
    } else if (parentMenuOption) {
      parentMenuOption.isOpen = true
    }

    if (parentMenuOption) {
      this.clearMenus(parentMenuOption)
    }

    const component = menu.instance

    this.lastMenu.push({
      component,
      parent: parentMenuOption,
      depth: this.lastMenu.length
    } as MenuStackEntry)

    if (!parentMenuOption) {
      position.y += window.scrollY
    }

    component.options = options
    component.position = position
    component.environment = this.env
    component.clickout = () => menu.hostView.destroy()
  }

  addRecentColor(color: string) {
    const exists = this.env.recentColors.indexOf(color)

    if (exists !== -1) {
      this.env.recentColors.splice(exists, 1)
    }

    this.env.recentColors.unshift(color)

    if (this.env.recentColors.length > 6) {
      this.env.recentColors.pop()
    }

    this.save()
  }

  addRecentDate(date: string) {
    const exists = this.env.recentDates.indexOf(date)

    if (exists !== -1) {
      this.env.recentDates.splice(exists, 1)
    }

    this.env.recentDates.unshift(date)

    if (this.env.recentDates.length > recentsLength) {
      this.env.recentDates.pop()
    }

    this.save()
  }

  isAnyDialogOpened() {
    return this.dialogs.length > 0
  }
}

export interface Env {
  sidepane: boolean,
  dblClickToOpen: boolean,
  lastBackup: string,
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
  expandedNav: boolean,
  showEmptiness: boolean,
  showOnly: number,
  syncInterval: number,
  recentColors: Array<string>,
  recentDates: Array<string>
}

export interface MenuOption {
  title: string,
  color?: string,
  invitation?: Invitation,
  disabled?: boolean,
  callback: (ctrlKey?: boolean) => void,
  shortcut?: string,
  menu?: Array<MenuOption>,

  isOpen?: boolean
}

interface MenuStackEntry {
  depth: number,
  parent: MenuOption,
  component: MenuComponent
}
