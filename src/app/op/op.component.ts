import { Component, OnInit } from '@angular/core';
import { UiService } from '../ui.service';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-options',
  templateUrl: './op.component.html',
  styleUrls: ['./op.component.css']
})
export class OpComponent implements OnInit {

  env: any;

  constructor(private ui: UiService, private api: ApiService) {
    this.env = this.ui.getEnv();
  }

  ngOnInit() {
    
  }
  
  update() {
    this.ui.save();
  }
  
  backup() {
    let dateStr = new Date().toLocaleDateString();
    let dataStr = new Blob([JSON.stringify(this.api.getRoot())], { type: 'application/json' });
    let dlAnchorElem = (document.createElement('A') as HTMLAnchorElement);
    dlAnchorElem.href = window.URL.createObjectURL(dataStr);
    dlAnchorElem.setAttribute('download', 'Inception Notes (' + dateStr + ').json');
    dlAnchorElem.click();
    
    this.env.lastBackup = dateStr;
    this.ui.save();
  }
}
