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
      description: '',
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
      description: '',
      color: '#ffffff',
      items: [],
      transient: true
    }
  }
  
  public newId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  private intro() {
    this.root = {"id":"1","name":"My Notes","color":"#80d8ff","items":[{"id":"2","name":"Welcome to Inception Notes!","color":"#ff80ab","items":[{"id":"3","name":"<b>Right-click</b> on the background to get help","color":"#ff8a80","items":[{"id":"6iym6z64jvpzdjifkbbd4","name":"","color":"#ffffff","items":[{"id":"2kot8paszqvmf2l60854b","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"4","name":"Have fun!","color":"#ea80fc","items":[{"id":"n2rr0yavuvfue8yzih7ph","name":"","color":"#ffffff","items":[{"id":"x30os7s5a8a6ddn7fbbey","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"8fqkfvmbpeprdr5qkmtfy","name":"","color":"#ffffff","items":[{"id":"rvkdp73eo8j8s1siswo1kn","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"5","name":"Main Projects","color":"#ffd180","items":[{"id":"6","name":"My First Project","color":"#E6E3D7","items":[{"id":"svzl75kjaxzke3388hq5","name":"","color":"#ffffff","items":[{"id":"5bu2d6cayltgglsa3rj96t","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"7","name":"My Other Project","color":"#E6E3D7","items":[{"id":"y6myizipp4fl1r1wbumk8","name":"","color":"#ffffff","items":[{"id":"j65h0qx65cqhxhs328odud","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"5fdesq1ani24a8lcagji83","name":"","color":"#ffffff","items":[{"id":"unzoyjab1lny7r03w0svq","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"8","name":"My Reminders","color":"#b9f6ca ","items":[{"id":"9","name":"Clean room","color":"#D7E6D9","items":[{"id":"kt6pmsjhrb8mqe7q01m88m","name":"","color":"#ffffff","items":[{"id":"1q7w32y3mxmn7khvt7soai","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"10","name":"Go for a run","color":"#D7E6D9","items":[{"id":"zs94wk79vs8c6wciisd36i","name":"","color":"#ffffff","items":[{"id":"9765317ropjc0whxj0b6xj","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"oujsqrwqbam4483m9mx7oa","name":"","color":"#ffffff","items":[{"id":"hqnw7g6vf3ce13urghd8fk","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"kq2y0nqf522rjhqrw3syt","name":"","color":"#ffffff","items":[{"id":"a9pk5dgufrn18p428pymkh","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":"Take notes here..."};
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
