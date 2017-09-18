import { Injectable } from '@angular/core';
import { UiService } from './ui.service';

@Injectable()
export class ApiService {

  private top: any;
  private notes: any;

  private view = {
    eye: null,
    show: null,
    parents: []
  };

  constructor(private ui: UiService) {
    this.load();
  }

  public save() {
    localStorage.setItem('top', this.top.id);
    localStorage.setItem('notes', this.freeze(this.notes));
  }

  public load() {
    let root = JSON.parse(localStorage.getItem('root'));

    if (root) {
      this.backupToFile(localStorage.getItem('root'));
      this.migrateRoot(root);
      setTimeout(() => {
        this.ui.dialog({
          message: 'Inception Notes has received an update.\n\nA backup copy of notes have been safely downloaded.'
        });
      }, 1000);
    } else {
      this.notes = this.unfreeze(localStorage.getItem('notes'));
    }

    if (!this.notes) {
      this.intro()
    }

    let top = localStorage.getItem('top');

    if (top) {
      this.top = this.notes[top];
    } else {
      for (let note of (<any>Object).values(this.notes)) {
        this.top = note;
        break;
      }
    }

    let view: any = localStorage.getItem('view');

    // Search for view and rebuild parents
    view = this.search(view);

    if (view) {
      this.view.eye = this.view.show = view;
    } else {
      this.view.eye = this.view.show = this.top;
    }
  }

  private freeze(animal: any) {
    if (!animal) {
      return null;
    }

    let fossil = {};

    for (let a of (<any>Object).values(animal)) {
      let items = [];

      for (let item of a.items) {
        items.push(item.id);
      }

      fossil[a.id] = {
        id: a.id,
        name: a.name,
        description: a.description,
        color: a.color,
        items: items,
        transient: a.transient,
        backgroundUrl: a.backgroundUrl
      };
    }

    return JSON.stringify(fossil);
  }

  private unfreeze(fossil: any) {
    fossil = JSON.parse(fossil);

    if (!fossil) {
        return null;
    }

    for (let a of (<any>Object).values(fossil)) {
      let items = [];

      for (let id of a.items) {
        let n = fossil[id];

        if (n) {
          items.push(n);
          n.parent = a;
        } else {
          console.log('unfreeze error: missing note \'' + id + '\'');
        }
      }

      a.items = items;
    }

    return fossil;
  }

  public backup() {
    this.backupToFile(this.freeze(this.notes));

    this.ui.getEnv().lastBackup = new Date().toLocaleDateString();
    this.ui.save();
  }

  public backupToFile(str: string) {
    let dateStr = new Date().toLocaleDateString();
    let dataStr = new Blob([str], { type: 'application/json' });
    let dlAnchorElem = (document.createElement('A') as HTMLAnchorElement);
    dlAnchorElem.href = window.URL.createObjectURL(dataStr);
    dlAnchorElem.setAttribute('download', 'Inception Notes (' + dateStr + ').json');
    dlAnchorElem.click();
  }

  private migrateRoot(root: any) {
    this.notes = {};

    this.top = root;
    this.migrateRootAdd(root);

    this.save();
    localStorage.removeItem('root');
  }

  private migrateRootAdd(note: any) {
    this.notes[note.id] = note;

    for (let subItem of note.items) {
        this.migrateRootAdd(subItem);
    }
  }

  public up() {
    if (this.view.eye === this.view.show) {
      let eye = this.search(this.view.show.id);

      if (!eye || !this.parents(eye).length) {
        this.ui.dialog({
          message: 'Create new list containing this one?',
          ok: () => this.breakCeiling()
        });
        return;
      }

      let parents = this.parents(eye);
      let show = parents[parents.length - 1];
      this.view.eye = show;
      this.view.show = show;
    } else {
      let show = this.search(this.view.show.id);

      if (!show || !show.parent) {
        return;
      }

      this.view.show = show.parent;
    }

    this.saveView();
  }

  private breakCeiling() {
    let id = this.newId();

    if (id in this.notes) {
      console.log('Cannot override note with id: ' + id);
      return;
    }

    let newTop = {
      id: id,
      name: 'New Master List',
      description: '',
      color: '#ffffff',
      items: [ this.top ]
    };

    this.top.parent = newTop;
    this.top = newTop;

    this.notes[id] = this.top;

    this.view.eye = this.view.show = this.top;
    this.saveView();
    this.save();
  }

  public getRoot() {
    return this.top;
  }

  public getLists() {
    return this.top.items;
  }

  public getEye() {
    return this.view.eye;
  }

  public setEye(eye: any) {
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

  public moveListUp(list: any) {
    let parents = this.parents(this.search(list.id));
    let parent = parents.length > 2 ? parents[parents.length - 2] : null;

    if (!parent) {
      return;
    }

    this.moveList(list.id, parent.id);
  }

  public moveList(listId: string, toListId: string) {
    if (listId === toListId) {
      return;
    }

    let list = this.search(listId);
    let toList = this.search(toListId);

    if (!list || !toList) {
      return;
    }

    let listParents = this.parents(list);
    let toListParents = this.parents(toList);

    let listParent = listParents.length ? listParents[listParents.length - 1] : null;

    for (let parent of toListParents) {
      if (parent.id === listId) {
        return;
      }
    }

    toList.items.push(list);

    if (listParent) {
      listParent.items.splice(listParent.items.indexOf(list), 1);
    }

    this.save();
  }

  public newBlankList(list: any = null, position: number = null) {
    let id;
    do { id = this.newId() } while(id in this.notes);

    let note: any = {
      id: id,
      name: '',
      description: '',
      color: '#ffffff',
      items: [],
      transient: true
    }

    this.notes[id] = note;

    if (list) {
      note.parent = note;

      if (position === null) {
        list.items.push(note);
      } else {
        list.items.splice(position, 0, note);
      }
    }

    return note;
  }

  public newId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private intro() {
    this.migrateRoot({"id":"1","name":"My Notes","color":"#80d8ff","items":[{"id":"2","name":"Welcome to Inception Notes!","color":"#ff80ab","items":[{"id":"3","name":"<b>Right-click</b> on the background to get help","color":"#ff8a80","items":[{"id":"6iym6z64jvpzdjifkbbd4","name":"","color":"#ffffff","items":[{"id":"2kot8paszqvmf2l60854b","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"4","name":"Have fun!","color":"#ea80fc","items":[{"id":"n2rr0yavuvfue8yzih7ph","name":"","color":"#ffffff","items":[{"id":"x30os7s5a8a6ddn7fbbey","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"8fqkfvmbpeprdr5qkmtfy","name":"","color":"#ffffff","items":[{"id":"rvkdp73eo8j8s1siswo1kn","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"5","name":"Main Projects","color":"#ffd180","items":[{"id":"6","name":"My First Project","color":"#E6E3D7","items":[{"id":"svzl75kjaxzke3388hq5","name":"","color":"#ffffff","items":[{"id":"5bu2d6cayltgglsa3rj96t","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"7","name":"My Other Project","color":"#E6E3D7","items":[{"id":"y6myizipp4fl1r1wbumk8","name":"","color":"#ffffff","items":[{"id":"j65h0qx65cqhxhs328odud","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"5fdesq1ani24a8lcagji83","name":"","color":"#ffffff","items":[{"id":"unzoyjab1lny7r03w0svq","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"8","name":"My Reminders","color":"#b9f6ca ","items":[{"id":"9","name":"Clean room","color":"#D7E6D9","items":[{"id":"kt6pmsjhrb8mqe7q01m88m","name":"","color":"#ffffff","items":[{"id":"1q7w32y3mxmn7khvt7soai","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"10","name":"Go for a run","color":"#D7E6D9","items":[{"id":"zs94wk79vs8c6wciisd36i","name":"","color":"#ffffff","items":[{"id":"9765317ropjc0whxj0b6xj","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"oujsqrwqbam4483m9mx7oa","name":"","color":"#ffffff","items":[{"id":"hqnw7g6vf3ce13urghd8fk","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":"kq2y0nqf522rjhqrw3syt","name":"","color":"#ffffff","items":[{"id":"a9pk5dgufrn18p428pymkh","name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":"Take notes here..."});
  }

  private search(id: string) {
    return this.notes[id];
  }

  private parents(note: any) {
    let list = [];

    if (!note) {
      return list;
    }

    while (note.parent && !list.includes(note.parent)) {
      list.unshift(note.parent);
      note = note.parent;
    }

    return list;
  }

  public contains(id: string, note: any) {

    if (!note || !note.items) {
      return false;
    }

    if (note.id === id) {
      return true;
    }

    for (let subItem of note.items) {
      if (this.contains(id, subItem)) {
        return true;
      }
    }

    return false;
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
}
