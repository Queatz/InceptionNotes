import { Component, OnInit } from '@angular/core';
import { UiService } from '../ui.service';
import { ApiService } from '../api.service';
import { VillageService } from '../village.service';

@Component({
  selector: 'app-options',
  templateUrl: './op.component.html',
  styleUrls: ['./op.component.css']
})
export class OpComponent implements OnInit {

  env: any;

  constructor(private ui: UiService, private api: ApiService, private village: VillageService) {
    this.env = this.ui.getEnv();
  }

  ngOnInit() {

  }

  update() {
    this.ui.save();
  }

  isVillageConnected() {
    return this.village.isConnected();
  }

  disconnectVillage() {
    this.village.disconnect();
  }

  villageName() {
    return this.village.me() && this.village.me().firstName;
  }

  backup() {
    let dateStr = new Date().toLocaleDateString();
    let dataStr = new Blob([this.api.backup()], { type: 'application/json' });
    let dlAnchorElem = (document.createElement('A') as HTMLAnchorElement);
    dlAnchorElem.href = window.URL.createObjectURL(dataStr);
    dlAnchorElem.setAttribute('download', 'Inception Notes (' + dateStr + ').json');
    dlAnchorElem.click();

    this.env.lastBackup = dateStr;
    this.ui.save();
  }
}
