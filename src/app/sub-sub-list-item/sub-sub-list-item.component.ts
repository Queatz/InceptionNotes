import { Component, OnInit, Input, HostListener } from '@angular/core';

import { ApiService } from '../api.service';
import { UiService } from '../ui.service';

@Component({
  selector: 'sub-sub-list-item',
  templateUrl: './sub-sub-list-item.component.html',
  styleUrls: ['./sub-sub-list-item.component.css'],
  host: {
    '[style.outline]': 'isDroppingList ? \'3px solid orange\' : undefined'
  }
})
export class SubSubListItemComponent implements OnInit {
  @Input() item: any;

  private isDroppingList: boolean;
  private dragCounter: number = 0;
  
  constructor(private api: ApiService) { }

  ngOnInit() {
  }
  
  @HostListener('dragenter', ['$event'])
  dragOn(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    this.dragCounter++;
    
    this.isDroppingList = true;
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
    this.api.moveList(id, this.item.id);
  }
  
  isSelectedNav(item: any) {
    return item === this.api.getShow() || this.api.traverse(this.api.getShow().id, item, []);
  }
  
  isExactSelectedNav(item: any) {
    return item === this.api.getShow();
  }
  
  openItem(dblclickEvent: Event, subItem: any) {
    dblclickEvent.stopPropagation();
    if (this.item.transient) {
      return;
    }
  
    this.api.setEye(subItem);
    
    return false;
  }
  
  showItem(dblclickEvent: Event, subItem: any) {
    dblclickEvent.stopPropagation();
    if (this.item.transient) {
      return;
    }
  
    this.api.setShow(subItem);
    
    return false;
  }
  
}
