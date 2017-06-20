import { Component, OnInit, Input } from '@angular/core';

import { ApiService } from '../api.service';
import { UiService } from '../ui.service';

@Component({
  selector: 'sub-sub-list-item',
  templateUrl: './sub-sub-list-item.component.html',
  styleUrls: ['./sub-sub-list-item.component.css']
})
export class SubSubListItemComponent implements OnInit {
  @Input() item: any;

  constructor(private api: ApiService) { }

  ngOnInit() {
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
