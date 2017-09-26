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

  /* Persistence */

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
          message: 'Inception Notes has received an update.\n\nA backup copy of notes have been downloaded. If all else fails, check Right Click -> Inspect -> Application (tab) -> Local Storage -> \'root\''
        });
      }, 1000);
    } else {
      this.notes = this.unfreeze(localStorage.getItem('notes'));
    }

    if (!this.notes) {
      this.intro()
    }

    this.resetView();
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
        backgroundUrl: a.backgroundUrl,
        _sync: a._sync
      };
    }

    return JSON.stringify(fossil);
  }

  public unfreeze(fossil: any) {
    if (typeof(fossil) === 'string') {
      fossil = JSON.parse(fossil);
    }

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

  /* View */

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

  resetView() {
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

  /* Etc */

  public getAllNotes() {
    return this.notes;
  }

  public getFrozenNotes() {
    return this.freeze(this.notes);
  }

  public getRoot() {
    return this.top;
  }

  public getLists() {
    return this.top.items;
  }

  public search(id: string) {
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

  /* Synchronization */

  public loadFrozenNotes(notes: string) {
    let n = this.unfreeze(notes);

    for(let note in n) {
      let nn = n[note];
      this.notes[note] = nn;

      if (nn.name.replace(/<(?:.|\n)*?>/gm, '').trim().length && !nn.parent) {
        this.getEye().items.push(nn);
      }
    }

    this.resetView();
    this.save();
  }

  /* Backup */

  public backup() {
    this.backupToFile(this.freeze(this.notes));

    this.ui.getEnv().lastBackup = new Date().toLocaleDateString();
    this.ui.save();
  }

  public unbackup() {
    this.ui.dialog({
      message: 'Notes will be loaded to their previous state.\n\nYou may lose notes.\n\nProceed?',
      ok: () => this.performUnbackup()
    });
  }

  private performUnbackup() {
    let dlAnchorElem = (document.createElement('INPUT') as HTMLInputElement);
    dlAnchorElem.type = 'file';
    dlAnchorElem.onchange = () => {
      let fr = new FileReader();
      fr.onloadend = () => {
        this.loadFrozenNotes(fr.result);
      };
      fr.readAsText(dlAnchorElem.files[0]);
    }
    dlAnchorElem.click();
  }

  public backupToFile(str: string) {
    let dateStr = new Date().toLocaleDateString();
    let dataStr = new Blob([str], { type: 'application/json' });
    let dlAnchorElem = (document.createElement('A') as HTMLAnchorElement);
    dlAnchorElem.href = window.URL.createObjectURL(dataStr);
    dlAnchorElem.setAttribute('download', 'Inception Notes (' + dateStr + ').json');
    dlAnchorElem.click();
  }

  /* Edit */

  public modified(note: any, prop: string = null) {
    if (prop === null) {
      delete note['_sync'];
    } else if ('_sync' in note) {
      if (prop in note['_sync']) {
        note['_sync'][prop].synchronized = false;
      }
    }
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

  public moveListUp(list: any) {
    let parents = this.parents(list);
    let parent = parents.length >= 2 ? parents[parents.length - 2] : null;

    if (!parent) {
      return;
    }

    this.moveList(list.id, parent.id);
  }

  public moveList(listId: string, toListId: string) {
    this.moveListToPosition(listId, toListId, -1);
  }

  public moveListToPosition(listId: string, toListId: string, position: number) {
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

    if (listParent !== toList) {
      for (let parent of toListParents) {
        if (parent.id === listId) {
          return;
        }
      }
    }

    let oldPos = null;

    if (listParent) {
      oldPos = listParent.items.indexOf(list);

      if (position !== -1) {
        if (oldPos < position) {
          position -= 1;
        }
      }

      listParent.items.splice(oldPos, 1);
      this.modified(listParent, 'items');
    }

    if (position >= 0 && position < toList.items.length) {
      toList.items.splice(position, 0, list);
    } else {
      toList.items.push(list);
    }

    this.modified(toList, 'items');

    list.parent = toList;

    this.save();
  }

  public newBlankList(list: any = null, position: number = null) {
    let id = this.newId();

    let note: any = {
      id: id,
      name: '',
      description: '',
      color: '#ffffff',
      items: [],
      transient: true
    };

    this.notes[id] = note;

    if (list) {
      note.parent = list;

      if (position === null) {
        list.items.push(note);
      } else {
        list.items.splice(position, 0, note);
      }

      this.modified(list, 'items');
    }

    return note;
  }

  /* Util */

  public newId() {
    let id;
    do { id = this.rawNewId() } while(this.notes && (id in this.notes));
    return id;
  }

  public rawNewId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private intro() {
    this.migrateRoot({"id":this.newId(),"name":"My Notes","color":"#80d8ff","items":[{"id":this.newId(),"name":"Welcome to Inception Notes!","color":"#ff80ab","items":[{"id":this.newId(),"name":"<b>Right-click</b> on the background to get help","color":"#ff8a80","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"Have fun!","color":"#ea80fc","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"Main Projects","color":"#ffd180","items":[{"id":this.newId(),"name":"My First Project","color":"#E6E3D7","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"My Other Project","color":"#E6E3D7","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"My Reminders","color":"#b9f6ca ","items":[{"id":this.newId(),"name":"Clean room","color":"#D7E6D9","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"Go for a run","color":"#D7E6D9","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":""},{"id":this.newId(),"name":"","color":"#ffffff","items":[{"id":this.newId(),"name":"","color":"#ffffff","items":[],"transient":true}],"transient":true}],"description":"Take notes here..."});
  }

  private migrateRoot(root: any) {
    this.notes = {};

    this.top = root;
    this.migrateRootAdd(root);

    this.save();
    // XXX TODO: localStorage.removeItem('root'); <-- add after some time
  }

  private migrateRootAdd(note: any) {
    this.notes[note.id] = note;

    for (let subItem of note.items) {
      subItem.parent = note;
      this.migrateRootAdd(subItem);
    }
  }
}
