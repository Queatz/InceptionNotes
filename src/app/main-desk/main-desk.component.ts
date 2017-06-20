import { Component, OnInit } from '@angular/core';
import { ApiService } from '../api.service';
import { UiService } from '../ui.service';

@Component({
  selector: 'main-desk',
  templateUrl: './main-desk.component.html',
  styleUrls: ['./main-desk.component.css'],
  host: {
    '(dblclick)': 'toggleSidepane()',
    '(contextmenu)': 'menu($event)'
  }
})
export class MainDeskComponent implements OnInit {

  constructor(public api: ApiService, public ui: UiService) {
  }

  ngOnInit() {
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
    }
  }
  
  getLists() {
    return this.api.getShow().items;
  }
  
  menu(event: Event) {
    event.preventDefault();
  
    this.ui.dialog({
      message: 'How to use Inception Notes\n\n1. Press F11 to make this act as your desktop\n2. Right-click on a note to change it\'s color\n3. Double-click on a note to focus\n4. Press escape to go to the previous note\n5. Double-click on the background to show/hide the sidepane\n6. Use Ctrl+Up/Down to easily move items'
    });
  }
  
  toggleSidepane() {
    this.ui.getEnv().sidepane = !this.ui.getEnv().sidepane;
  }

  private initNext() {
    let items = this.getLists();
    
    if (items.length && items[items.length - 1].transient) {
      return;
    }
    
    this.getLists().push({
      name: '',
      color: '#ffffff',
      items: [],
      transient: true
    });
  }
}
