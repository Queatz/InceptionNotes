import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  ElementRef,
  Input,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {ApiService} from '../api.service';
import {UiService, MenuOption} from '../ui.service';
import {VillageService} from '../village.service';
import {OpComponent} from '../op/op.component';
import {SearchComponent} from '../search/search.component';
import {AddPeopleComponent} from 'app/add-people/add-people.component';
import Util from 'app/util';
import {FilterService} from 'app/filter.service'
import {Subject} from 'rxjs'
import {takeUntil} from 'rxjs/operators'

@Component({
  selector: 'main-desk',
  templateUrl: './main-desk.component.html',
  styleUrls: ['./main-desk.component.css'],
  host: {
    '[style.background-color]': 'list.backgroundUrl && list.backgroundUrl.indexOf(\'//\') === -1 ? list.backgroundUrl : (getEnv().useDarkTheme ? \'#404040\' : undefined)',
    '[style.background-image]': 'list.backgroundUrl && list.backgroundUrl.indexOf(\'//\') !== -1 ? (\'url(\' + list.backgroundUrl + \')\') : undefined'
  }
})
export class MainDeskComponent implements OnInit, OnChanges, OnDestroy {

  @Input() list: any;

  @ViewChild('listsContainer', {read: ViewContainerRef}) listsContainer: ViewContainerRef;

  private destroyed = new Subject<void>()

  private lastListSelected: any | undefined;
  readonly onSelection: Subject<{
    lastList: any | undefined,
    list: any | undefined,
    selected: boolean,
    ctrl: any,
    shift: any
  }> = new Subject();

  private readonly selectedListIds = new Set<string>();

  constructor(
    public api: ApiService,
    public filter: FilterService,
    public village: VillageService,
    public ui: UiService,
    private elementRef: ElementRef) {
  }

  getSelectedListIds(): Array<string> {
    return Array.from(this.selectedListIds.values());
  }

  ngOnInit() {
    this.initNext();

    this.ui.locate.pipe(
      takeUntil(this.destroyed)
    ).subscribe(locate => {
      const idx = this.getLists().indexOf(locate.list);

      if (document.documentElement && idx !== -1) {
        const y = ((this.listsContainer.element.nativeElement as HTMLDivElement).children[idx] as HTMLDivElement).offsetTop -
          Util.convertRemToPixels(1);
        document.documentElement.scrollTo({
          top: y,
          behavior: locate.animate === false ? 'auto' : 'smooth'
        })
      }
    })
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.initNext();
  }

  onItemModified(item: any) {
    this.initNext();
  }

  onItemRemoved(item: any) {
    if (this.getLists().length > 1) {
      const c = this.api.getSubItemNames(item);

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

  onItemSelected(list: any, event: { selected: boolean, ctrl: boolean, shift: boolean }) {
    this.onSelection.next({ lastList: this.lastListSelected, list, selected: event.selected, ctrl: event.ctrl, shift: event.shift });
    this.lastListSelected = list;
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
      message: 'Change background image url or color',
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
    const location = this.list.items.indexOf(item);

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

    setTimeout(() =>
      this.elementRef.nativeElement.querySelectorAll('sub-list')[(location + move)]
        .querySelector('.sub-list-title').focus());
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
    const v = !!this.village.me();

    if (!v) {
      opts = [
        {title: 'Search...', shortcut: 'ALT + S', callback: () => this.showSearch(null)},
        {title: 'Filter...', shortcut: 'ALT + F', callback: () => this.showFilter(null)},
        {title: 'Change background...', callback: () => this.changeBackground()},
        // { title: 'Connect with Village...', callback: () => this.village.connect() },
        {title: 'Options...', shortcut: 'ALT + O', callback: () => this.showOptions(null)}
      ];
    } else {
      opts = [
        {title: 'Search...', shortcut: 'ALT + S', callback: () => this.showSearch(null)},
        {title: 'Filter...', shortcut: 'ALT + F', callback: () => this.showFilter(null)},
        {title: 'Change background...', callback: () => this.changeBackground()},
        // { title: 'Add people...', callback: () => this.addPeople(this.list) },
        {title: 'Options...', shortcut: 'ALT + O', callback: () => this.showOptions(null)},
      ];
    }

    this.ui.menu([
      {title: 'New note...', callback: () => this.newNoteAtPosition(event.pageX, event.pageY)},
      ...opts
    ], {x: event.clientX, y: event.clientY});
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
      message: 'How to use Inception Notes\n\n1. Right-click on a note to change it\'s color\n3. Double-click on a note to enter that note\n4. Press escape to go to the parent note\n5. Double-click on the background to show/hide the sidepane\n6. Use Ctrl+Up/Down to move items\n7. Use Ctrl+Down to "snip" off the last item of a list\n8. Use ALT+S to search\n9. Use ALT+F to filter by links',
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
          this.api.addRecent('search', note.id);
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

  @HostListener('window:keydown.alt.f', ['$event'])
  showFilter(event: Event) {
    if (this.ui.isAnyDialogOpened()) {
      return;
    }

    if (event) {
      event.preventDefault();
    }

    this.ui.dialog({
      message: 'Filter by links',
      input: true,
      view: SearchComponent,
      init: dialog => {
        dialog.component.instance.recentWhich = 'filter';

        dialog.changes.subscribe(val => {
          dialog.component.instance.searchString = val;
          dialog.component.instance.ngOnChanges(null);
        });
        dialog.component.instance.onSelection.subscribe(note => {
          this.api.addRecent('filter', note.id);
          this.filter.toggleRef(note);
          dialog.back();
        });
        dialog.component.instance.resultsChanged.subscribe(results => {
          dialog.model.results = results;
        });
      },
      ok: result => {
        if (result.results && result.results.length) {
          this.api.addRecent('filter', result.results[0].id);
          this.filter.toggleRef(result.results[0]);
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

  @HostListener('click', ['$event'])
  unselectAll(event: Event) {
    this.dontPropagate(event);

    if (this.getLists().length > 0) {
      this.onSelection.next({
        lastList: undefined,
        list: undefined,
        selected: false,
        ctrl: false,
        shift: false
      })
    }
  }

  onSelectionChange(list: any, selected: boolean) {
    if (selected) {
      this.selectedListIds.add(list.id);
    } else {
      this.selectedListIds.delete(list.id);
    }
  }

  getItemLinkText(item: any) {
    let t = '';
    let p = item.parent;

    for (let i = 0; i < 3 && p; i++) {
      t += ' → ' + p.name;
      p = p.parent;
    }

    return Util.htmlToText(t);
  }

  removeFilter(event: Event, item: any) {
    event.stopPropagation();
    this.filter.toggleRef(item);

    return false;
  }

  showFilterOptions(event: MouseEvent, item: any) {
    event.preventDefault();
    event.stopPropagation();

    this.ui.menu([
      {
        title: 'Remove filter',
        callback: () => this.filter.toggleRef(item)
      }
    ], {x: event.clientX, y: event.clientY});
  }

  private initNext() {
    const items = this.getLists();

    if (items.length && Util.isEmptyStr(this.list.items[items.length - 1].name)) {
      return;
    }

    const l = this.api.newBlankList(this.list);
    l.color = this.getShow().color;
    l.options = this.getShow().options;
    this.api.modified(l);
    this.api.setAllPropsSynced(l);
  }

  up() {
    this.api.up();
  }

  hasEvents() {
    return false;
  }

  private newNoteAtPosition(x: number, y: number) {
    const children = [ ...this.listsContainer.element.nativeElement.childNodes ]
    let notes: Array<any> = children.map((child, index) => {
      return {
        match: (x > child.offsetLeft + child.offsetWidth && y > child.offsetTop) ||
          (x > child.offsetLeft && y > child.offsetTop + child.offsetHeight),
        index
      }
    }).filter(item => item.match);

    let note = notes[notes.length - 1];
    let indexOffset = 0;

    if (!note) {
      notes = children.map((child, index) => {
        return {
          match: y > child.offsetTop,
          y: child.offsetTop,
          index
        }
      }).filter(item => item.match);

      while (notes.length > 1 && notes[notes.length - 1].y === notes[notes.length - 2].y) {
        notes.pop()
      }

      note = notes[notes.length - 1];
      indexOffset = -1;
    }

    const l = this.api.newBlankList(this.list, note ? note.index + 1 + indexOffset : 0);
    l.color = this.getShow().color;
    l.options = this.getShow().options;
    this.api.modified(l);
    this.api.setAllPropsSynced(l);
  }
}
