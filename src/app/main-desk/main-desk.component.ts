import { Component, OnInit, OnChanges, SimpleChanges, ElementRef, Input, HostListener } from '@angular/core';
import { ApiService } from '../api.service';
import { UiService } from '../ui.service';
import { VillageService } from '../village.service';
import { OpComponent } from '../op/op.component';

@Component({
  selector: 'main-desk',
  templateUrl: './main-desk.component.html',
  styleUrls: ['./main-desk.component.css'],
  host: {
    '[style.background-color]': 'list.backgroundUrl[0] === \'#\' ? list.backgroundUrl : (getEnv().useDarkTheme ? \'#404040\' : undefined)',
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
    if (item.transient) {
      item.transient = false;
      this.initNext();
    }
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
    this.api.save();
  }

  saveDescription() {
    this.api.modified(this.list, 'description');
    this.api.save();
  }

  dontPropagate(event: Event) {
    event.stopPropagation();
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
          this.api.save();
        }
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
    this.api.modified(this.list, 'description');
    this.api.save();

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

    let opts;
    let v = !!this.village.me();

    if (!v) {
      opts = [
        'Change background...',
        'Connect with Village...',
        'Options...'
      ];
    } else {
      opts = [
        'Change background...',
        'Sync...',
        'Options...'
      ];
    }

    this.ui.menu(opts, { x: event.clientX, y: event.clientY },
    choose => {
      switch (choose) {
        case 0:
          this.changeBackground();
          break;
        case 1:
          if (this.village.isConnected()) {
            if (v) {
              this.village.sync();
            } else {
              this.ui.dialog({
                message: 'Not connected to Village.  Retry?',
                ok: () => this.village.connect()
              });
            }
          } else {
            this.village.connect();
          }
          break;
        case 2:
          this.ui.dialog({
            message: 'How to use Inception Notes\n\n1. Press F11 to make this act as your desktop\n2. Right-click on a note to change it\'s color\n3. Double-click on a note to focus\n4. Press escape to go to the previous note\n5. Double-click on the background to show/hide the sidepane\n6. Use Ctrl+Up/Down to easily move items\n7. Use Ctrl+Down to "snip" off the last item of a list',
            view: OpComponent
          });
          break;
      }
    });
  }


  @HostListener('dblclick')
  toggleSidepane() {
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane;
    this.ui.save();
  }

  private initNext() {
    let items = this.getLists();

    if (items.length && items[items.length - 1].transient) {
      return;
    }

    let l = this.api.newBlankList(this.list);
    l.color = this.getShow().color;
  }

  up() {
    this.api.up();
  }
}
