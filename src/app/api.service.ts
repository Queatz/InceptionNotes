import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { UiService } from './ui.service';
import { Subject } from 'rxjs';
import Util from 'app/util';

export class NoteChanges {
  public note: any;
  public property: string;

  constructor(note: any, property: string) {
    this.note = note;
    this.property = property;
  }
}

export class ViewConfig {
  eye: any;
  show: any;
  parents: any[];
}

@Injectable()
export class ApiService {

  private top: any;
  private notes: Map<string, any>;
  private people: Map<string, any>;

  private view: ViewConfig = {
    eye: null,
    show: null,
    parents: []
  };

  public onNoteChangedObservable: Subject<NoteChanges> = new Subject<NoteChanges>();
  public onViewChangedObservable: Subject<ViewConfig> = new Subject<ViewConfig>();

  constructor(private ui: UiService, private router: Router) {
    this.people = new Map();
    this.load();
  }

  /* Persistence */

  public save() {
    localStorage.setItem('top', this.top.id);
  }

  public load() {
    let version = +localStorage.getItem('version');
    let root = null;

    if (version < 1) {
      root = JSON.parse(localStorage.getItem('root'));
    }

    if (root) {
      this.backupToFile(localStorage.getItem('root'));
      this.migrateRoot(root);
      setTimeout(() => {
        this.ui.dialog({
          message: 'Inception Notes has received an update.\n\nA backup copy of notes have been downloaded. If all else fails, check Right Click -> Inspect -> Application (tab) -> Local Storage -> \'root\''
        });
      }, 1000);
    }
    
    if (version < 2) {
      localStorage.setItem('version', '2');
      this.notes = this.unfreeze(localStorage.getItem('notes'));
      this.saveAll();      
    }

    let localNotes = new Map<string, any>();
    for (let n in localStorage) {
      if (n.substring(0, 5) === 'note:') {
        let n2 = JSON.parse(localStorage.getItem(n));
        localNotes[n2.id] = n2;
      } else if(n.substring(0, 7) === 'person:') {
        this.updatePerson(JSON.parse(localStorage.getItem(n)));
      }
    }

    if (Object.keys(localNotes).length) {
      Object.keys(localNotes).forEach(k => {
        localNotes[k] = this.unfreezeNote(localNotes[k], localNotes);
      });

      this.notes = localNotes;
    }

    if (!this.notes) {
      this.intro()
    }

    this.resetView();
  }

  public saveAll() {
    if (!this.notes) {
      return;
    }

    Object.keys(this.notes).forEach(k => {
      this.saveNote(this.notes[k]);
    });
  }

  /**
   * Load a single note.
   */
  public loadNote(note: string) {
    
  }

  /**
   * Save a single note
   */
  public saveNote(note: any) {
    localStorage.setItem('note:' + note.id, JSON.stringify(this.freezeNote(note)));
  }

  private freeze(animal: any) {
    if (!animal) {
      return null;
    }

    let fossil = {};

    for (let a of (<any>Object).values(animal)) {
      fossil[a.id] = this.freezeNote(a);
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
      this.unfreezeNote(a, fossil);
    }

    return fossil;
  }

  /**
   * Semi-freeze a single note
   */
  public freezeNote(a: any): any {
    let items = undefined;
    if (a.items) {
      items = [];
      for (let item of a.items) {
        items.push(item.id);
      }
    }

    let ref = undefined;
    if (a.ref) {
      ref = [];
      for (let item of a.ref) {
        ref.push(item.id);
      }
    }

    let people = undefined;
    if (a.people) {
      people = [];
      for (let person of a.people) {
        people.push(person.id);
      }
    }
    
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      color: a.color,
      items: items,
      ref: ref,
      people: people,
      backgroundUrl: a.backgroundUrl,
      collapsed: a.collapsed,
      estimate: a.estimate,
      _sync: a._sync
    };
  }

  /**
   * Unfreeze a note
   * 
   * @param a The currently semi-frozen note
   * @param fossil A pool of semi-frozen notes 
   */
  public unfreezeNote(a: any, fossil: any) {
    let items = [];

    if (!a.items) {
      a.items = [];
    }

    for (let id of a.items) {
      let n = fossil[id];

      if (!n) {
        console.log('unfreeze error: missing note \'' + id + '\'');
        n = this.newBlankNote(true, id);
      }

      items.push(n);
      n.parent = a;
    }

    a.items = items;

    if (a.ref) {
      let ref = [];

      for (let id of a.ref) {
        let n = fossil[id];

        if (!n) {
          console.log('unfreeze error: missing note \'' + id + '\'');
          n = this.newBlankNote(true, id);
        }

        ref.push(n);
      }

      a.ref = ref;
    }

    if (a.people) {
      let people = [];

      for (let id of a.people) {
        let n = this.person(id);
        people.push(n)
      }

      a.people = people;
    }

    return a;
  }

  /**
   * Unfreeze a property
   */
  unfreezeProp(note: any, prop: string, value: any) {
    if (['people', 'ref', 'items'].indexOf(prop) !== -1) {
      if (!value) {
        return [];
      }
  
      let a = [];
      for (let id of value) {
        let n = this.search(id);

        if (!n) {
          n = this.newBlankNote(true, id);
          if (note) {
            n.color = note.color;
          }
          this.saveNote(n);
        }
  
        a.push(n);

        if (prop === 'items') {
          n.parent = note;
        }
      }
      
      return a;
    }

    return value;
  }

  /* People */

  /**
   * Get a person by Village Id
   */
  public person(id: string) {
    if (this.people.has(id)) {
      return this.people.get(id);
    }

    let p = { id: id };
    this.people.set(id, p);
    return p;
  }

  public updatePerson(person: any) {
    if (!person || !person.id) {
      return;
    }

    let p = this.person(person.id);
    Object.assign(p, person);
    localStorage.setItem('person:' + person.id, JSON.stringify(p));
  }

  public addPersonToNote(note: any, person: any) {
    person = this.person(person.id);

    if (!note.people) {
      note.people = [];
    }

    if (note.people.indexOf(person) !== -1) {
      return;
    }

    note.people.push(person);
    this.modified(note, 'people');
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
    let show: any = localStorage.getItem('view-show') || view;

    view = this.search(view);
    show = this.search(show);

    if (view) {
      this.view.eye = view;
      this.view.show = show;
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
    this.router.navigate(['n', this.view.show.id]);        
    localStorage.setItem('view', this.view.eye.id);
    localStorage.setItem('view-show', this.view.show.id);

    this.onViewChangedObservable.next(this.view);
  }

  /* Etc */

  public getAllNotes(): Map<string, any> {
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

  public contains(id: string, note: any, exclude: any[] = null) {
    if (!note || !note.items) {
      return false;
    }

    if (note.id === id) {
      return true;
    }

    if (!exclude) {
      exclude = [];
    }

    if (exclude.indexOf(note) !== -1) {
      return true;
    }

    exclude.push(note);

    for (let subItem of note.items) {
      if (this.contains(id, subItem, exclude)) {
        return true;
      }
    }

    return false;
  }

  public getSubItemEstimates(item: any, exclude: any[] = null): Array<number> {
    let result: Array<number> = [];

    if (!exclude) {
      exclude = [];
    }

    if (exclude.indexOf(item) !== -1) {
      return result;
    }

    if (item.estimate) {
        result.push(item.estimate);
    }

    exclude.push(item);

    for (let subItem of item.items) {
      result = result.concat(this.getSubItemEstimates(subItem, exclude));
    }

    return result;
  }

  public getSubItemNames(item: any, exclude: any[] = null): Array<string> {
    let result: Array<string> = [];

    if (!exclude) {
      exclude = [];
    }

    if (exclude.indexOf(item) !== -1) {
      return result;
    }

    exclude.push(item);

    for (let subItem of item.items) {
      if (!subItem.name) {
        continue;
      }

      result.push(subItem.name);
      result = result.concat(this.getSubItemNames(subItem, exclude));
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
    this.saveAll();
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
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);
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
    
    this.saveNote(note);
    this.onNoteChangedObservable.next(new NoteChanges(note, prop));
  }

  /**
   * Set a note as synced.
   */
  public setSynced(id: string, prop: string) {
    let note = this.search(id);

    if (!note) {
      console.log('Cannot set note as synced: ' + id);
      return;
    }

    this.setPropSynced(note, prop);
    this.saveNote(note);
  }

  /**
   * Set all props synced
   */
  public setAllPropsSynced(note: any) {
    Object.keys(note).forEach(prop => {
      if (prop === 'id') return;
      this.setPropSynced(note, prop);
    });
  }

  /**
   * setPropSynced
   */
  public setPropSynced(note: any, prop: string) {
    if (!('_sync' in note)) {
      note['_sync'] = {};
    }

    if(!(prop in note['_sync'])) {
      note['_sync'][prop] = {};
    }

    note['_sync'][prop].time = new Date().getTime();
    note['_sync'][prop].synchronized = true;
  }

  isSynced(note: any, prop: string): boolean {
    return ('_sync' in note) && (prop in note['_sync']) && note['_sync'][prop].synchronized;
  }

  /**
   * Set all notes as needing sync.
   */
  public setAllNotesUnsynced() {
    (<any>Object).values(this.notes).forEach(note => this.modified(note));
  }

  /**
   * 
   */
  private breakCeiling() {
    let id = this.newId();

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
    this.modified(newTop);
  }

  public moveListUp(list: any, position: number = -1) {
    let parents = this.parents(list);
    let parent = parents.length >= 2 ? parents[parents.length - 2] : null;

    if (!parent) {
      return;
    }

    if (position !== -1) {
      this.moveListToPosition(list.id, parent.id, position);
    } else {
      this.moveList(list.id, parent.id);
    }
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

      listParent.items.splice(oldPos, 1);
      this.modified(listParent, 'items');
    }

    if (toList === listParent && oldPos < position) {
      position--;
    }

    if (position >= 0 && position < toList.items.length) {
      toList.items.splice(position, 0, list);
    } else {
      toList.items.push(list);
    }

    this.modified(toList, 'items');

    list.parent = toList;
  }

  public newBlankList(list: any = null, position: number = null) {
    let note: any = this.newBlankNote();

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


  public newBlankNote(fromServer?: boolean, id?: string): any {
    if (!id) id = this.newId();
    
    let note = {
      id: id,
      name: '',
      description: '',
      color: '#ffffff',
      items: []
    };

    if (this.notes) {
      this.notes[note.id] = note;
    }

    if (fromServer) {
      this.setAllPropsSynced(note);
    }

    return note;
  }

  /* Relationships */

  public addRef(list: any, toList: any) {
    if (list === toList) {
      return;
    }

    if (!toList.ref) {
      toList.ref = [];
    }

    if (!list.ref) {
      list.ref = [];
    }

    if (toList.ref.indexOf(list) !== -1) {
      return;
    }

    if (list.ref.indexOf(toList) !== -1) {
      return;
    }

    toList.ref.push(list);
    this.modified(toList, 'ref');

    list.ref.push(toList);
    this.modified(list, 'ref');
  }

  public removeRef(list: any, toList: any) {
    if (list === toList) {
      return;
    }

    if (toList.ref) {
      let idx = toList.ref.indexOf(list);

      if (idx !== -1) {
        toList.ref.splice(idx, 1);
        this.modified(toList, 'ref');
      }
    }

    if (list.ref) {
      let idx = list.ref.indexOf(toList);

      if (idx !== -1) {
        list.ref.splice(idx, 1);
        this.modified(list, 'ref');
      }
    }
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
    this.notes = this.unfreeze({"9ecal36r08qsegt2q7ruar":{"id":"9ecal36r08qsegt2q7ruar","name":"My Notes","description":"Take notes here...","color":"#80d8ff","items":["ezyw5zl0s7k5ky66oz7368","tprx0gv41gepcofy7yia","tpot361b974p1mn3jxbr4","7fv55sy73d7epp5kqnguul"],"ref":[]},"ezyw5zl0s7k5ky66oz7368":{"id":"ezyw5zl0s7k5ky66oz7368","name":"Welcome to Inception Notes!","description":"","color":"#ff80ab","items":["3ooxxyu6ko97smbzcigvza","7llyfbgu4eb9rae6kb074l","s3flakxhf2mb8pixx0w1l","isqms385v5batkjoztpn15"],"ref":[]},"3ooxxyu6ko97smbzcigvza":{"id":"3ooxxyu6ko97smbzcigvza","name":"<b>Right-click</b> on the background to get help","description":"","color":"#ff8a80","items":["r8um73em8ikjy1847ituem"],"ref":[]},"r8um73em8ikjy1847ituem":{"id":"r8um73em8ikjy1847ituem","name":"","color":"#ffffff","items":["do7uegwh31lf6qu8lxpye"],"ref":[]},"do7uegwh31lf6qu8lxpye":{"id":"do7uegwh31lf6qu8lxpye","name":"","color":"#ffffff","items":[],"ref":[]},"s3flakxhf2mb8pixx0w1l":{"id":"s3flakxhf2mb8pixx0w1l","name":"Have fun!","description":"","color":"#ea80fc","items":["rjq9391912ae63xb2e8y"],"ref":[]},"rjq9391912ae63xb2e8y":{"id":"rjq9391912ae63xb2e8y","name":"","color":"#ffffff","items":["rgmgxz8fabchssd0j75acb"],"ref":[]},"rgmgxz8fabchssd0j75acb":{"id":"rgmgxz8fabchssd0j75acb","name":"","color":"#ffffff","items":[],"ref":[]},"isqms385v5batkjoztpn15":{"id":"isqms385v5batkjoztpn15","name":"","color":"#ffffff","items":["w0ok2ypdxqugorshz54l"],"ref":[]},"w0ok2ypdxqugorshz54l":{"id":"w0ok2ypdxqugorshz54l","name":"","color":"#ffffff","items":[],"ref":[]},"tprx0gv41gepcofy7yia":{"id":"tprx0gv41gepcofy7yia","name":"Main Projects","description":"","color":"#ffd180","items":["bxw7hfpcmytcq0738o31ef","rbcx2x3og4b2ty3efm4aux","whfs7lj4i5gzrdyifbt4td","7oknreb5imgufsn1ohxcib","ialkx35n6mo697qcqaulvl"],"ref":[]},"bxw7hfpcmytcq0738o31ef":{"id":"bxw7hfpcmytcq0738o31ef","name":"My First Project","description":"","color":"#E6E3D7","items":["di8colqbb8lyyvf5gidqqj"],"ref":[]},"di8colqbb8lyyvf5gidqqj":{"id":"di8colqbb8lyyvf5gidqqj","name":"","color":"#ffffff","items":["t6tdhnfx3ydzbvul20lti"],"ref":[]},"t6tdhnfx3ydzbvul20lti":{"id":"t6tdhnfx3ydzbvul20lti","name":"","color":"#ffffff","items":[],"ref":[]},"rbcx2x3og4b2ty3efm4aux":{"id":"rbcx2x3og4b2ty3efm4aux","name":"My Other Project","description":"","color":"#E6E3D7","items":["pl7mhv8mjxqs48qw1n3ku"],"ref":[]},"pl7mhv8mjxqs48qw1n3ku":{"id":"pl7mhv8mjxqs48qw1n3ku","name":"","color":"#ffffff","items":["yvnljwa9yhhqk3pqztuwh"],"ref":[]},"yvnljwa9yhhqk3pqztuwh":{"id":"yvnljwa9yhhqk3pqztuwh","name":"","color":"#ffffff","items":[],"ref":[]},"whfs7lj4i5gzrdyifbt4td":{"id":"whfs7lj4i5gzrdyifbt4td","name":"Big project!","color":"#ff80ab","items":["0xbh8qf3zrnfjfl0ibldk1","eeg9e8s76diffzstgsuch","ci0zuqdnygdbqbcw7g74tp","ftard0ob3qvu6yeinge5hr","977zrwrwinb41yjrncg0et"],"ref":[]},"0xbh8qf3zrnfjfl0ibldk1":{"id":"0xbh8qf3zrnfjfl0ibldk1","name":"First task","color":"#ffffff","items":["ycwwxs46gwnzama41koc"],"ref":[],"estimate":2},"tpot361b974p1mn3jxbr4":{"id":"tpot361b974p1mn3jxbr4","name":"My Reminders","description":"","color":"#b9f6ca ","items":["uc54p4plm19f9sgnnwux3i","isfiozt8g5ppt4y4u9hni","2b05yurzcc6z0au55zknfc"],"ref":[]},"uc54p4plm19f9sgnnwux3i":{"id":"uc54p4plm19f9sgnnwux3i","name":"Clean room","description":"","color":"#D7E6D9","items":["1pxfcxl9yxpop7cu9nnu2e"],"ref":[]},"1pxfcxl9yxpop7cu9nnu2e":{"id":"1pxfcxl9yxpop7cu9nnu2e","name":"","color":"#ffffff","items":["tut1poxh5ejbn9429bc9"],"ref":[]},"tut1poxh5ejbn9429bc9":{"id":"tut1poxh5ejbn9429bc9","name":"","color":"#ffffff","items":[],"ref":[]},"isfiozt8g5ppt4y4u9hni":{"id":"isfiozt8g5ppt4y4u9hni","name":"Go for a run","description":"","color":"#D7E6D9","items":["mhnttcm1ca3hd7cnvxg8a"],"ref":[]},"mhnttcm1ca3hd7cnvxg8a":{"id":"mhnttcm1ca3hd7cnvxg8a","name":"","color":"#ffffff","items":["zuo967kb1dsecaunq3eszq"],"ref":[]},"zuo967kb1dsecaunq3eszq":{"id":"zuo967kb1dsecaunq3eszq","name":"","color":"#ffffff","items":[],"ref":[]},"2b05yurzcc6z0au55zknfc":{"id":"2b05yurzcc6z0au55zknfc","name":"","color":"#ffffff","items":["qc12atkaitmosp34yv95c"],"ref":[]},"qc12atkaitmosp34yv95c":{"id":"qc12atkaitmosp34yv95c","name":"","color":"#ffffff","items":[],"ref":[]},"7oknreb5imgufsn1ohxcib":{"id":"7oknreb5imgufsn1ohxcib","name":"My Categories","color":"#ffffff","items":["9vk9ywmx4szziub8qxqo","ez1lvoo3dwkwmhdrh9s77","9ywa2zu4zgtbqz8v7sa2j"],"ref":[]},"9vk9ywmx4szziub8qxqo":{"id":"9vk9ywmx4szziub8qxqo","name":"🐊 Fun","color":"#80d8ff","items":["34606nw061xmm5vbsi9r6c"],"ref":["7llyfbgu4eb9rae6kb074l"]},"jugi69kmkhdq0k459wehn":{"id":"jugi69kmkhdq0k459wehn","name":"","description":"","color":"#ffd180","items":["ym01shouprrrrfsnxmzh"],"ref":[]},"ym01shouprrrrfsnxmzh":{"id":"ym01shouprrrrfsnxmzh","name":"","description":"","color":"#ffd180","items":[],"ref":[]},"ftard0ob3qvu6yeinge5hr":{"id":"ftard0ob3qvu6yeinge5hr","name":"Bonus task!","description":"","color":"#ff80ab","items":["4a07xdt072df7qw4tzvrjt"],"ref":[],"estimate":1},"eeg9e8s76diffzstgsuch":{"id":"eeg9e8s76diffzstgsuch","name":"Second task","description":"","color":"#ff80ab","items":["8o3pww4qn1xq2luyz717c"],"ref":[],"estimate":2},"ci0zuqdnygdbqbcw7g74tp":{"id":"ci0zuqdnygdbqbcw7g74tp","name":"Third task","description":"","color":"#ff80ab","items":["yyuay36cjzf57s18hg0d5t"],"ref":[],"estimate":4},"163j3kckevih3kmtfqkstf9":{"id":"163j3kckevih3kmtfqkstf9","name":"<br>","description":"","color":"#80d8ff","items":["djzte0aqmudbb88jo448qe"],"ref":[]},"977zrwrwinb41yjrncg0et":{"id":"977zrwrwinb41yjrncg0et","name":"","description":"","color":"#ff80ab","items":["bmdf45dmf5jfz96rxkq10h"],"ref":[]},"ycwwxs46gwnzama41koc":{"id":"ycwwxs46gwnzama41koc","name":"","description":"","color":"#ffffff","items":[],"ref":[]},"8o3pww4qn1xq2luyz717c":{"id":"8o3pww4qn1xq2luyz717c","name":"","description":"","color":"#ff80ab","items":[],"ref":[]},"yyuay36cjzf57s18hg0d5t":{"id":"yyuay36cjzf57s18hg0d5t","name":"","description":"","color":"#ff80ab","items":[],"ref":[]},"4a07xdt072df7qw4tzvrjt":{"id":"4a07xdt072df7qw4tzvrjt","name":"","description":"","color":"#ff80ab","items":[],"ref":[]},"djzte0aqmudbb88jo448qe":{"id":"djzte0aqmudbb88jo448qe","name":"","description":"","color":"#ff80ab","items":[],"ref":[]},"bmdf45dmf5jfz96rxkq10h":{"id":"bmdf45dmf5jfz96rxkq10h","name":"","description":"","color":"#ff80ab","items":[],"ref":[]},"7llyfbgu4eb9rae6kb074l":{"id":"7llyfbgu4eb9rae6kb074l","name":"I'm a task with links!","description":"","color":"#ff80ab","items":["jc0m3uxidpb1krerkvh3v2"],"ref":["9vk9ywmx4szziub8qxqo","ez1lvoo3dwkwmhdrh9s77"]},"7fv55sy73d7epp5kqnguul":{"id":"7fv55sy73d7epp5kqnguul","name":"","description":"","color":"#80d8ff","items":["v52993i59eby59317v6ejc"],"ref":[]},"v52993i59eby59317v6ejc":{"id":"v52993i59eby59317v6ejc","name":"","description":"","color":"#80d8ff","items":[],"ref":[]},"9ywa2zu4zgtbqz8v7sa2j":{"id":"9ywa2zu4zgtbqz8v7sa2j","name":"","description":"","color":"#ffffff","items":["7khopamf94pri5sb56dtwr"],"ref":[]},"ez1lvoo3dwkwmhdrh9s77":{"id":"ez1lvoo3dwkwmhdrh9s77","name":"🐟 Easy","description":"","color":"#ffd180","items":["nmhbxh86d9gpf3zgxcv0e"],"ref":["7llyfbgu4eb9rae6kb074l"]},"34606nw061xmm5vbsi9r6c":{"id":"34606nw061xmm5vbsi9r6c","name":"","description":"","color":"#ffffff","items":[],"ref":[]},"nmhbxh86d9gpf3zgxcv0e":{"id":"nmhbxh86d9gpf3zgxcv0e","name":"","description":"","color":"#ffffff","items":[],"ref":[]},"7khopamf94pri5sb56dtwr":{"id":"7khopamf94pri5sb56dtwr","name":"","description":"","color":"#ffffff","items":[],"ref":[]},"jc0m3uxidpb1krerkvh3v2":{"id":"jc0m3uxidpb1krerkvh3v2","name":"","description":"","color":"#ff80ab","items":["uw92fsodzs8scqpxraedd"],"ref":[]},"uw92fsodzs8scqpxraedd":{"id":"uw92fsodzs8scqpxraedd","name":"","description":"","color":"#ff80ab","items":[],"ref":[]},"ialkx35n6mo697qcqaulvl":{"id":"ialkx35n6mo697qcqaulvl","name":"","description":"","color":"#ffd180","items":["jb9zpt8uecbm04vlm2hg2h"],"ref":[]},"jb9zpt8uecbm04vlm2hg2h":{"id":"jb9zpt8uecbm04vlm2hg2h","name":"","description":"","color":"#ffd180","items":[],"ref":[]}});
    this.top = this.notes['9ecal36r08qsegt2q7ruar'];
    let localify = this.rawNewId();
    (<any>Object).values(this.notes).forEach(n => n.id = n.id + localify);
    this.saveAll();
  }

  private migrateRoot(root: any) {
    this.notes = new Map<string, any>();

    this.top = root;
    this.migrateRootAdd(root);

    this.saveAll();
    localStorage.setItem('version', '1');
  }

  private migrateRootAdd(note: any) {
    this.notes[note.id] = note;

    for (let subItem of note.items) {
      subItem.parent = note;
      this.migrateRootAdd(subItem);
    }
  }
}
