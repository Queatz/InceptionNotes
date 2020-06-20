import { Component, OnInit, OnChanges, SimpleChanges, ElementRef, Input, HostListener } from '@angular/core';
import { ApiService } from '../api.service';
import { UiService, MenuOption } from '../ui.service';
import { VillageService } from '../village.service';
import { OpComponent } from '../op/op.component';
import { SearchComponent } from '../search/search.component';
import { DialogConfig } from 'app/dialog/dialog.component';
import { AddPeopleComponent } from 'app/add-people/add-people.component';
import Util from 'app/util';

@Component({
  selector: 'main-desk',
  templateUrl: './main-desk.component.html',
  styleUrls: ['./main-desk.component.css'],
  host: {
    '[style.background-color]': 'list.backgroundUrl && list.backgroundUrl[0] === \'#\' ? list.backgroundUrl : (getEnv().useDarkTheme ? \'#404040\' : undefined)',
    '[style.background-image]': 'list.backgroundUrl ? (\'url(\' + list.backgroundUrl + \')\') : undefined'
  }
})
export class MainDeskComponent implements OnInit, OnChanges {

  @Input() list: any;

  constructor(public api: ApiService, public village: VillageService, public ui: UiService, private elementRef: ElementRef) {
  }

  ngOnInit() {
  	this.initNext();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.initNext();
  }

  onItemModified(item: any) {
    this.initNext();
  }

  onItemRemoved(item: any) {
    if (this.getLists().length > 1) {
      let c = this.api.getSubItemNames(item);

      if (!c.length) {
        this.removeItem(item);
      } else {
        this.ui.dialog({
          message: 'Also delete ' + c.length + ' sub-item' + (c.length === 1 ? '' : 's') + '?\n\n' + c.join('\n'),
          ok: () => {
            this.removeItem(item);
          }
        });
      }
    }
  }

  private removeItem(item: any) {
    this.list.items.splice(this.list.items.indexOf(item), 1);
    this.api.modified(this.list, 'items');
  }

  saveDescription() {
    this.api.modified(this.list, 'description');
  }

  dontPropagate(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  changeBackground() {
    this.ui.dialog({
      message: 'Change background image url',
      input: true,
      prefill: this.list.backgroundUrl || '',
      ok: result => {
        if (result.input) {
          this.list.backgroundUrl = result.input;
          this.api.modified(this.list, 'backgroundUrl');
        }
      }
    });
  }

  addPeople(list: any) {
    this.ui.dialog({
      message: 'Add people',
      input: true,
      view: AddPeopleComponent,
      init: dialog => {
        dialog.changes.subscribe(input => {
          (<AddPeopleComponent>dialog.component.instance).search(input);
        });

        (<AddPeopleComponent>dialog.component.instance).onSelection.subscribe(person => {
          dialog.back();
          this.api.addPersonToNote(this.list, person);
        });
      }
    });
  }

  moveItem(event: Event, item: any, move: number) {
    let location = this.list.items.indexOf(item);

    if (location === -1) {
      return;
    }

    if (move < 0 && location === 0) {
      return;
    }

    if (move > 0 && location === this.list.items.length - 1) {
      return;
    }

    this.list.items.splice(location, 1);
    this.list.items.splice(location + move, 0, item);
    this.api.modified(this.list, 'items');

    setTimeout(() => this.elementRef.nativeElement.querySelectorAll('sub-list')[(location + move)].querySelector('.sub-list-title').focus());
  }

  getShow() {
    return this.list;
  }

  getLists() {
    return this.list.items;
  }

  getEnv() {
    return this.ui.getEnv();
  }

  @HostListener('contextmenu', ['$event'])
  menu(event: MouseEvent) {
    event.preventDefault();

    let opts: Array<MenuOption>;
    let v = !!this.village.me();

    if (!v) {
      opts = [
        { title: 'Search...', shortcut: 'ALT + S', callback: () => this.showSearch(null) },
        { title: 'Change background...', callback: () => this.changeBackground() },
        { title: 'Connect with Village...', callback: () => this.village.connect() },
        { title: 'Options...', shortcut: 'ALT + O', callback: () => this.showOptions(null) }
      ];
    } else {
      opts = [
        { title: 'Search...', shortcut: 'ALT + S', callback: () => this.showSearch(null) },
        { title: 'Change background...', callback: () => this.changeBackground() },
        { title: 'Add people...', callback: () => this.addPeople(this.list) },
        { title: 'Options...', shortcut: 'ALT + O', callback: () => this.showOptions(null) },
      ];
    }

    this.ui.menu(opts, { x: event.clientX, y: event.clientY });
  }

  @HostListener('window:keydown.alt.o', ['$event'])
  showOptions(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this.ui.dialog({
      message: 'How to use Inception Notes\n\n1. Press F11 to make this act as your desktop\n2. Right-click on a note to change it\'s color\n3. Double-click on a note to focus\n4. Press escape to go to the previous note\n5. Double-click on the background to show/hide the sidepane\n6. Use Ctrl+Up/Down to easily move items\n7. Use Ctrl+Down to "snip" off the last item of a list\n8. Use ALT+S to search',
      view: OpComponent
    });
  }

  @HostListener('window:keydown.alt.s', ['$event'])
  showSearch(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this.ui.dialog({
      message: 'Search',
      input: true,
      view: SearchComponent,
      init: dialog => {
          dialog.changes.subscribe(val => {
              dialog.component.instance.searchString = val;
              dialog.component.instance.ngOnChanges(null);
          });
          dialog.component.instance.onSelection.subscribe(note => {
              this.api.setEye(note);
              dialog.back();
          });
          dialog.component.instance.resultsChanged.subscribe(results => {
              dialog.model.results = results;
          });
      },
      ok: result => {
          if (result.results && result.results.length) {
              this.api.addRecent('search', result.results[0].id);
              this.api.setEye(result.results[0]);
          }
      }
    });
  }
  
  @HostListener('window:keydown.alt.p')
  showAsPriority(event: Event) {
    this.ui.getEnv().showAsPriorityList = !this.ui.getEnv().showAsPriorityList;
    this.ui.getEnv().sidepane = !this.ui.getEnv().showAsPriorityList;
    this.ui.save();
  }

  @HostListener('dblclick', ['$event'])
  toggleSidepane(event: Event) {
    this.dontPropagate(event);
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane;
    this.ui.save();
  }

  private initNext() {
    let items = this.getLists();

    if (items.length && Util.isEmptyStr(this.list.items[items.length - 1].name)) {
      return;
    }

    let l = this.api.newBlankList(this.list);
    l.color = this.getShow().color;
    this.api.modified(l);
    this.api.setAllPropsSynced(l);
  }

  up() {
    this.api.up();
  }
}
