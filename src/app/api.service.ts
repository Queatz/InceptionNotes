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
    
    let view: any = localStorage.getItem('view');
    
    // Search for view and rebuild parents
    view = this.search(view);
    
    if (view) {
      this.view.eye = this.view.show = view.view;
      this.view.parents = view.parents;
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
      id: this.newId(),
      name: 'New Master List',
      color: '#ffffff',
      items: [ this.root ]
    };
    
    this.view.parents = [];
    this.view.eye = this.view.show = this.root;
    this.saveView();
    this.save();
  }

  public getRoot() {
    return this.root;
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
    localStorage.setItem('view', this.view.eye.id);
  }
  
  public newBlankList() {
    return {
      id: this.newId(),
      name: '',
      color: '#ffffff',
      items: [],
      transient: true
    }
  }
  
  public newId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  private intro() {
    this.root = {
      id: '1',
      name: 'My Notes',
      color: '#E6E3D7',
      items: [
        {
          id: '2',
          name: 'Welcome to Inception Notes!',
          color: '#E6E3D7',
          items: [
            {
              id: '3',
              name: '<B>Right-click</B> on the background to get help',
              color: '#E6E3D7',
              items: []
            }, {
              id: '4',
              name: 'Have fun!',
              color: '#E6E3D7',
              items: []
            }
          ]
        },
        {
          id: '5',
          name: 'Main Projects',
          color: '#E6E3D7',
          items: [
            {
              id: '6',
              name: 'My First Project',
              color: '#E6E3D7',
              items: []
            },
            {
              id: '7',
              name: 'My Other Project',
              color: '#E6E3D7',
              items: []
            }
          ]
        }, {
          id: '8',
          name: 'My Reminders',
          color: '#D7E6D9',
          items: [
            {
              id: '9',
              name: 'Clean room',
              color: '#D7E6D9',
              items: []
            }, {
              id: '10',
              name: 'Go for a run',
              color: '#D7E6D9',
              items: []
            }
          ]
        }
      ]
    }
  }
  
  private search(id: string) {
    return this.traverse(id, this.root, []);
  }
  
  public getSubItemNames(item: any): Array<string> {
    let result: Array<string> = [];
    
    for (let subItem of item.items) {
      if (subItem.transient) {
        continue;
      }
      
      result.push(subItem.name);
      result = result.concat(this.getSubItemNames(subItem));
    }
    
    return result;
  }
  
  public traverse(id: string, cursor: any, parents: Array<any>) {
    parents = Array.from(parents);
  
    if (cursor.id === id) {
      return {
        view: cursor,
        parents: parents
      };
    }
    
    parents.push(cursor);
  
    for (let item of cursor.items) {
      let query = this.traverse(id, item, parents);
      
      if (query) {
        return query;
      }
    }
  }
}
