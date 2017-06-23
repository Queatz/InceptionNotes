import { Component, ElementRef, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges, HostListener, HostBinding } from '@angular/core';

import { ApiService } from '../api.service';
import { UiService } from '../ui.service';

@Component({
  selector: 'sub-list',
  templateUrl: './sub-list.component.html',
  styleUrls: ['./sub-list.component.css'],
  host: {
    '[style.background-color]': 'useAsNavigation ? transparent : list.color',
    '[style.outline]': 'isDroppingList ? \'3px solid orange\' : undefined',
    '[style.opacity]': 'isDraggingList ? \'0.5\' : undefined',
    '[style.cursor]': 'useAsNavigation ? \'default\' : undefined'
  }
})
export class SubListComponent implements OnInit, OnChanges {

	@Input() list: any;
	@Input() useAsNavigation: any;
	@Output('modified') modified = new EventEmitter();
	@Output('removed') removed = new EventEmitter();

  private isDraggingList: boolean;
  private isDroppingList: boolean;
  private dragCounter: number = 0;

  constructor(private ui: UiService, private api: ApiService, private elementRef: ElementRef) { }

  ngOnInit() {
    this.initNext();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    this.initNext();
  }
  
  @HostListener('contextmenu', ['$event'])
  showOptions(event) {
    event.preventDefault();
    event.stopPropagation();
    
    this.ui.dialog({
      message: 'Change color',
      input: true,
      prefill: this.list.color,
      ok: result => {
        if (result.input) {
          this.list.color = result.input;
          this.api.save();
        }
      }
    });
  }
  
  @HostBinding('draggable')
  get draggable() {
    return !this.useAsNavigation;
  }
  
  @HostListener('dragstart', ['$event'])
  startDrag(event: DragEvent) {
    if (this.useAsNavigation) {
      return;
    }
    
    event.stopPropagation();
    
    this.isDraggingList = true;
    event.dataTransfer.setData('application/x-id', this.list.id);
  }
  
  @HostListener('dragend', ['$event'])
  stopDrag(event: DragEvent) {
    if (this.useAsNavigation) {
      return;
    }
    
    event.stopPropagation();
    
    this.isDraggingList = false;
  }
  
  @HostListener('dragenter', ['$event'])
  dragOn(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    this.dragCounter++;
    
    if (!this.isDraggingList) {
      this.isDroppingList = true;
    }
  }
  
  @HostListener('dragleave', ['$event'])
  dragOff(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    this.dragCounter--;
    
    // This is here to prevent flickering
    if (this.dragCounter < 1) {
      this.isDroppingList = false;
    }
  }
  
  @HostListener('dragover', ['$event'])
  nothing() {
    event.preventDefault();
    event.stopPropagation();
  };
  
  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDroppingList = false;
    this.dragCounter = 0;
    let id = event.dataTransfer.getData('application/x-id');
    
    if (id) {
      this.api.moveList(id, this.list.id);
    } else {
      let text = event.dataTransfer.getData('text/plain');
      
      if (text) {
        let l = this.newBlankList();
        l.name = text;
        this.list.items.push(l);
      }
    }
  }
  
  isSelectedNav(item: any) {
    return item === this.api.getShow() || this.api.traverse(item.id, this.api.getShow(), []);
  }
  
  openList(dblclickEvent: Event) {
    dblclickEvent.stopPropagation();
    if (this.list.transient) {
      return;
    }
  
    this.api.setEye(this.list);
    
    return false;
  }
  
  openItem(dblclickEvent: Event, item: any) {
    dblclickEvent.stopPropagation();
    if (this.list.transient) {
      return;
    }
  
    this.api.setEye(item);
    
    return false;
  }
  
  showItem(dblclickEvent: Event, item: any) {
    dblclickEvent.stopPropagation();
    if (this.list.transient) {
      return;
    }
  
    this.api.setShow(item);
    
    return false;
  }
  
  onNameChange() {
    this.api.save();
    
    if (this.list.name) {
      this.modified.emit(this.list);
    }
  }
  
  private isEmptyName(name: string) {
    return !name.replace(/<(?:.|\n)*?>/gm, '').trim();
  }
  
  getSubitemText(item: any) {
    let c = this.countSubItems(item);
    
    return c ? c + ' sub-item' + (c === 1 ? '' : 's') : 'No sub-items';
  }
  
  getAfterText(item: any) {
    let c = this.countSubItems(item);
    
    return c ? ' (' + c + ')' : null;
  }
  
  onNameBackspacePressed() {
    if (this.isEmptyName(this.list.name)) {
      this.removed.emit();
    }
  }
  
  onNameEnterPressed(element: any) {
    this.list.items.splice(0, 0, this.newBlankList());
    
    setTimeout(() => {
      let n = element.nextElementSibling.children[0];
      if (n && n.focus) {
        n.focus();
      }
    });
    
    return false;
  }
  
  onItemChange(item: any) {
    this.api.save();
    
    if (item.transient && item.name) {
      item.transient = undefined;
      this.initNext();
      this.modified.emit(item);
    }
  }
  
  moveItem(event: Event, item: any, move: number) {
    event.stopPropagation();
    
    let location = this.list.items.indexOf(item);

    if (location === -1) {
      return;
    }
    
    if (move < 0 && location === 0) {
      return;
    }
    
    if (move > 0 && location === this.list.items.length - 1) {
      this.api.moveListUp(item);
      return;
    }
    
    this.list.items.splice(location, 1);
    this.list.items.splice(location + move, 0, item);
    this.api.save();
    
    setTimeout(() => this.elementRef.nativeElement.querySelectorAll('.sub-list-item')[(location + move)].focus());
  }
  
  onItemEnterPressed(element: any, item: any) {
    if (element.nextSibling && element.nextSibling.focus) {
      let i = this.list.items.indexOf(item);
      
      if (i !== -1) {
        this.list.items.splice(i + 1, 0, this.newBlankList());
        setTimeout(() => element.nextSibling.focus());
      } else {
        element.nextSibling.focus();
      }
    } else if (item.name) {
      item.transient = false;
      this.initNext();
      setTimeout(() => element.nextSibling.focus());
    }
    
    return false;
  }
  
  onItemBackspacePressed(element: any, item: any) {
    if (this.isEmptyName(item.name) && this.list.items.length > 1) {
      let c = this.api.getSubItemNames(item);
    
      if (c.length) {
        this.ui.dialog({
          message: 'Also delete ' + c.length + ' sub-item' + (c.length === 1 ? '' : 's') + '?\n\n' + c.join('\n'),
          ok: () => {
            this.deleteItem(element, item);
          }
        });
      } else {
        this.deleteItem(element, item);
      }
    }
  }
  
  countSubItems(item: any) {
    return this.api.getSubItemNames(item).length;
  }
  
  getEnv() {
    return this.ui.getEnv();
  }
  
  @HostListener('click', ['$event'])
  @HostListener('dblclick', ['$event'])
  dontPropagate(event: Event) {
    event.stopPropagation();
  }
  
  private deleteItem(element: any, item: any) {
    this.list.items.splice(this.list.items.indexOf(item), 1);

    let e = element.previousElementSibling || element.parentNode.previousElementSibling;

    if (e && e.focus) {
      e.focus();
    }
  }

  private initNext() {
    // Heal notes without ids
    if (!this.list.id) {
      this.list.id = this.api.newId();
    }
  
    if (this.useAsNavigation) {
      return;
    }
  
    if (this.list.items.length && this.list.items[this.list.items.length - 1].transient) {
      return;
    }
    
    this.list.items.push(this.newBlankList());
  }
  
  private newBlankList() {
    let l = this.api.newBlankList();
    l.color = this.list.color;
    return l;
  }
}
