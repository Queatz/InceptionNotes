import { Injectable } from '@angular/core';
import { UiService } from './ui.service';

@Injectable()
export class ApiService {

  private root: any;
  
  private view = {
    eye: null,
    show: null,
    parents: []
  };

  constructor(private ui: UiService) {
    this.load();
  }

  public save() {
    localStorage.setItem('root', JSON.stringify(this.root));
  }

  public load() {
    this.root = JSON.parse(localStorage.getItem('root'));
    
    if (!this.root) {
      this.intro();
    }
    
    let view = null;//JSON.parse(localStorage.getItem('view'));
    
    if (view) {
      this.view = view; // XXX This introduces a bug, because views are persisted as duplicated objects
    } else {
      this.view.eye = this.view.show = this.root;
    }
  }

  public up() {
    if (!this.view.parents.length) {
      this.ui.dialog({
        message: 'Create new list containing this one?',
        ok: () => this.breakCeiling()
      });
      return;
    }
  
    let eye = this.view.parents.pop();
    this.view.eye = eye;
    this.view.show = eye;
    this.saveView();
  }
  
  private breakCeiling() {
    this.root = {
      name: 'New Master List',
      color: '#ffffff',
      items: [ this.root ]
    };
    
    this.view.parents = [];
    this.view.eye = this.view.show = this.root;
    this.saveView();
    this.save();
  }

  public getLists() {
    return this.root.items;
  }

  public getEye() {
    return this.view.eye;
  }

  public setEye(eye: any) {
    if (eye !== this.view.eye) {
      this.view.parents.push(this.view.eye);
    }
  
    this.view.eye = eye;
    this.view.show = this.view.eye;
    this.saveView();
  }

  public getShow() {
    return this.view.show;
  }

  public setShow(show: any) {
    this.view.show = show;
    this.saveView();
  }
  
  private saveView() {
    localStorage.setItem('view', JSON.stringify(this.view));
  }
  
  private intro() {
    this.root = {
    name: 'My Notes',
    color: '#E6E3D7',
    items: [
      {
        name: 'Welcome to Inception Notes!',
        color: '#E6E3D7',
        items: [
          {
            name: '<B>Right-click</B> on the background to get help',
            color: '#E6E3D7',
            items: []
          }, {
            name: 'Have fun!',
            color: '#E6E3D7',
            items: []
          }
        ]
      },
      {
        name: 'Main Projects',
        color: '#E6E3D7',
        items: [
          {
            name: 'My First Project',
            color: '#E6E3D7',
            items: []
          },
          {
            name: 'My Other Project',
            color: '#E6E3D7',
            items: []
          }
        ]
      }, {
        name: 'My Reminders',
        color: '#D7E6D9',
        items: [
          {
            name: 'Clean room',
            color: '#D7E6D9',
            items: []
          }, {
            name: 'Go for a run',
            color: '#D7E6D9',
            items: []
          }
        ]
      }
    ]
  }
  }
}
