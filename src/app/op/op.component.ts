import { Component, OnInit } from '@angular/core';
import { UiService } from '../ui.service';
import { ApiService } from '../api.service';
import { VillageService } from '../village.service';
import { Config } from 'app/config.service';

@Component({
  selector: 'app-options',
  templateUrl: './op.component.html',
  styleUrls: ['./op.component.css']
})
export class OpComponent implements OnInit {

  env: any;

  constructor(private ui: UiService, private api: ApiService, private village: VillageService, private config: Config) {
    this.env = this.ui.getEnv();
  }

  ngOnInit() {

  }

  update() {
    this.ui.save();
  }

  isVillageConnected() {
    return !!this.village.me();
  }

  disconnectVillage() {
    this.village.disconnect();
  }

  nukeVillage() {
    this.village.nuke();
  }

  villageName() {
    return this.village.me() && this.village.me().firstName;
  }

  villageUrl() {
    return this.config.vlllageUrl() + (this.village.me() && this.village.me().googleUrl);
  }

  backup() {
    this.api.backup();
  }

  unbackup() {
    this.api.unbackup();
  }
}
