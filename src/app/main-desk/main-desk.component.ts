import { Component, OnInit, OnChanges, SimpleChanges, ElementRef } from '@angular/core';
import { ApiService } from '../api.service';
import { UiService } from '../ui.service';
import { OpComponent } from '../op/op.component';

@Component({
  selector: 'main-desk',
  templateUrl: './main-desk.component.html',
  styleUrls: ['./main-desk.component.css'],
  host: {
    '(dblclick)': 'toggleSidepane()',
    '(contextmenu)': 'menu($event)'
  }
})
export class MainDeskComponent implements OnInit, OnChanges {

  constructor(public api: ApiService, public ui: UiService, private elementRef: ElementRef) {
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
      this.getLists().splice(this.getLists().indexOf(item), 1);
      this.api.save();
    }
  }
  
  saveDescription() {
    this.api.save();
  }

  dontPropagate(event: Event) {
    event.stopPropagation();
  }
  
  moveItem(event: Event, item: any, move: number) {
    let lists = this.getLists();
    let location = lists.indexOf(item);
    
    if (location === -1) {
      return;
    }
    
    if (move < 0 && location === 0) {
      return;
    }
    
    if (move > 0 && location === lists.length - 1) {
      return;
    }
    
    lists.splice(location, 1);
    lists.splice(location + move, 0, item);
    this.api.save();
    
    setTimeout(() => this.elementRef.nativeElement.querySelectorAll('sub-list')[(location + move)].querySelector('.sub-list-title').focus());
  }
  
  getShow() {
    return this.api.getShow();
  }
  
  getLists() {
    return this.api.getShow().items;
  }
  
  getEnv() {
    return this.ui.getEnv();
  }
  
  menu(event: Event) {
    event.preventDefault();
  
    this.ui.dialog({
      message: 'How to use Inception Notes\n\n1. Press F11 to make this act as your desktop\n2. Right-click on a note to change it\'s color\n3. Double-click on a note to focus\n4. Press escape to go to the previous note\n5. Double-click on the background to show/hide the sidepane\n6. Use Ctrl+Up/Down to easily move items',
      view: OpComponent
    });
  }
  
  toggleSidepane() {
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane;
    this.ui.save();
  }

  private initNext() {
    let items = this.getLists();
    
    if (items.length && items[items.length - 1].transient) {
      return;
    }
    
    this.getLists().push(this.api.newBlankList());
  }
}
