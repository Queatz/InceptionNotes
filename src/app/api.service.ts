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
    let root = null;

    if (localStorage.getItem('version') !== '1') {
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

      let ref = [];
      if (a.ref) {
        for (let item of a.ref) {
          ref.push(item.id);
        }
      }

      fossil[a.id] = {
        id: a.id,
        name: a.name,
        description: a.description,
        color: a.color,
        items: items,
        ref: ref,
        transient: a.transient,
        backgroundUrl: a.backgroundUrl,
        collapsed: a.collapsed,
        estimate: a.estimate,
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

      if (a.ref) {
        let ref = [];

        for (let id of a.ref) {
          let n = fossil[id];

          if (n) {
            ref.push(n);
          } else {
            console.log('unfreeze error: missing note \'' + id + '\'');
          }
        }

        a.ref = ref;
      }
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
    localStorage.setItem('view', this.view.eye.id);
    localStorage.setItem('view-show', this.view.show.id);
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
     if (item.transient) {
         return result;
     }

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
      if (subItem.transient) {
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
  }

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
    this.save();
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

    this.save();
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

    this.save();
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
    this.notes = this.unfreeze({"9ecal36r08qsegt2q7ruar":{"id":"9ecal36r08qsegt2q7ruar","name":"My Notes","description":"Take notes here...","color":"#80d8ff","items":["ezyw5zl0s7k5ky66oz7368","tprx0gv41gepcofy7yia","tpot361b974p1mn3jxbr4","7fv55sy73d7epp5kqnguul"],"ref":[]},"ezyw5zl0s7k5ky66oz7368":{"id":"ezyw5zl0s7k5ky66oz7368","name":"Welcome to Inception Notes!","description":"","color":"#ff80ab","items":["3ooxxyu6ko97smbzcigvza","7llyfbgu4eb9rae6kb074l","s3flakxhf2mb8pixx0w1l","isqms385v5batkjoztpn15"],"ref":[]},"3ooxxyu6ko97smbzcigvza":{"id":"3ooxxyu6ko97smbzcigvza","name":"<b>Right-click</b> on the background to get help","description":"","color":"#ff8a80","items":["r8um73em8ikjy1847ituem"],"ref":[]},"r8um73em8ikjy1847ituem":{"id":"r8um73em8ikjy1847ituem","name":"","color":"#ffffff","items":["do7uegwh31lf6qu8lxpye"],"ref":[],"transient":true},"do7uegwh31lf6qu8lxpye":{"id":"do7uegwh31lf6qu8lxpye","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"s3flakxhf2mb8pixx0w1l":{"id":"s3flakxhf2mb8pixx0w1l","name":"Have fun!","description":"","color":"#ea80fc","items":["rjq9391912ae63xb2e8y"],"ref":[]},"rjq9391912ae63xb2e8y":{"id":"rjq9391912ae63xb2e8y","name":"","color":"#ffffff","items":["rgmgxz8fabchssd0j75acb"],"ref":[],"transient":true},"rgmgxz8fabchssd0j75acb":{"id":"rgmgxz8fabchssd0j75acb","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"isqms385v5batkjoztpn15":{"id":"isqms385v5batkjoztpn15","name":"","color":"#ffffff","items":["w0ok2ypdxqugorshz54l"],"ref":[],"transient":true},"w0ok2ypdxqugorshz54l":{"id":"w0ok2ypdxqugorshz54l","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"tprx0gv41gepcofy7yia":{"id":"tprx0gv41gepcofy7yia","name":"Main Projects","description":"","color":"#ffd180","items":["bxw7hfpcmytcq0738o31ef","rbcx2x3og4b2ty3efm4aux","whfs7lj4i5gzrdyifbt4td","7oknreb5imgufsn1ohxcib","ialkx35n6mo697qcqaulvl"],"ref":[]},"bxw7hfpcmytcq0738o31ef":{"id":"bxw7hfpcmytcq0738o31ef","name":"My First Project","description":"","color":"#E6E3D7","items":["di8colqbb8lyyvf5gidqqj"],"ref":[]},"di8colqbb8lyyvf5gidqqj":{"id":"di8colqbb8lyyvf5gidqqj","name":"","color":"#ffffff","items":["t6tdhnfx3ydzbvul20lti"],"ref":[],"transient":true},"t6tdhnfx3ydzbvul20lti":{"id":"t6tdhnfx3ydzbvul20lti","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"rbcx2x3og4b2ty3efm4aux":{"id":"rbcx2x3og4b2ty3efm4aux","name":"My Other Project","description":"","color":"#E6E3D7","items":["pl7mhv8mjxqs48qw1n3ku"],"ref":[]},"pl7mhv8mjxqs48qw1n3ku":{"id":"pl7mhv8mjxqs48qw1n3ku","name":"","color":"#ffffff","items":["yvnljwa9yhhqk3pqztuwh"],"ref":[],"transient":true},"yvnljwa9yhhqk3pqztuwh":{"id":"yvnljwa9yhhqk3pqztuwh","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"whfs7lj4i5gzrdyifbt4td":{"id":"whfs7lj4i5gzrdyifbt4td","name":"Big project!","color":"#ff80ab","items":["0xbh8qf3zrnfjfl0ibldk1","eeg9e8s76diffzstgsuch","ci0zuqdnygdbqbcw7g74tp","ftard0ob3qvu6yeinge5hr","977zrwrwinb41yjrncg0et"],"ref":[]},"0xbh8qf3zrnfjfl0ibldk1":{"id":"0xbh8qf3zrnfjfl0ibldk1","name":"First task","color":"#ffffff","items":["ycwwxs46gwnzama41koc"],"ref":[],"estimate":2},"tpot361b974p1mn3jxbr4":{"id":"tpot361b974p1mn3jxbr4","name":"My Reminders","description":"","color":"#b9f6ca ","items":["uc54p4plm19f9sgnnwux3i","isfiozt8g5ppt4y4u9hni","2b05yurzcc6z0au55zknfc"],"ref":[]},"uc54p4plm19f9sgnnwux3i":{"id":"uc54p4plm19f9sgnnwux3i","name":"Clean room","description":"","color":"#D7E6D9","items":["1pxfcxl9yxpop7cu9nnu2e"],"ref":[]},"1pxfcxl9yxpop7cu9nnu2e":{"id":"1pxfcxl9yxpop7cu9nnu2e","name":"","color":"#ffffff","items":["tut1poxh5ejbn9429bc9"],"ref":[],"transient":true},"tut1poxh5ejbn9429bc9":{"id":"tut1poxh5ejbn9429bc9","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"isfiozt8g5ppt4y4u9hni":{"id":"isfiozt8g5ppt4y4u9hni","name":"Go for a run","description":"","color":"#D7E6D9","items":["mhnttcm1ca3hd7cnvxg8a"],"ref":[]},"mhnttcm1ca3hd7cnvxg8a":{"id":"mhnttcm1ca3hd7cnvxg8a","name":"","color":"#ffffff","items":["zuo967kb1dsecaunq3eszq"],"ref":[],"transient":true},"zuo967kb1dsecaunq3eszq":{"id":"zuo967kb1dsecaunq3eszq","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"2b05yurzcc6z0au55zknfc":{"id":"2b05yurzcc6z0au55zknfc","name":"","color":"#ffffff","items":["qc12atkaitmosp34yv95c"],"ref":[],"transient":true},"qc12atkaitmosp34yv95c":{"id":"qc12atkaitmosp34yv95c","name":"","color":"#ffffff","items":[],"ref":[],"transient":true},"7oknreb5imgufsn1ohxcib":{"id":"7oknreb5imgufsn1ohxcib","name":"My Categories","color":"#ffffff","items":["9vk9ywmx4szziub8qxqo","ez1lvoo3dwkwmhdrh9s77","9ywa2zu4zgtbqz8v7sa2j"],"ref":[],"transient":false},"9vk9ywmx4szziub8qxqo":{"id":"9vk9ywmx4szziub8qxqo","name":"🐊 Fun","color":"#80d8ff","items":["34606nw061xmm5vbsi9r6c"],"ref":["7llyfbgu4eb9rae6kb074l"]},"jugi69kmkhdq0k459wehn":{"id":"jugi69kmkhdq0k459wehn","name":"","description":"","color":"#ffd180","items":["ym01shouprrrrfsnxmzh"],"ref":[],"transient":true},"ym01shouprrrrfsnxmzh":{"id":"ym01shouprrrrfsnxmzh","name":"","description":"","color":"#ffd180","items":[],"ref":[],"transient":true},"ftard0ob3qvu6yeinge5hr":{"id":"ftard0ob3qvu6yeinge5hr","name":"Bonus task!","description":"","color":"#ff80ab","items":["4a07xdt072df7qw4tzvrjt"],"ref":[],"estimate":1},"eeg9e8s76diffzstgsuch":{"id":"eeg9e8s76diffzstgsuch","name":"Second task","description":"","color":"#ff80ab","items":["8o3pww4qn1xq2luyz717c"],"ref":[],"estimate":2},"ci0zuqdnygdbqbcw7g74tp":{"id":"ci0zuqdnygdbqbcw7g74tp","name":"Third task","description":"","color":"#ff80ab","items":["yyuay36cjzf57s18hg0d5t"],"ref":[],"estimate":4},"163j3kckevih3kmtfqkstf9":{"id":"163j3kckevih3kmtfqkstf9","name":"<br>","description":"","color":"#80d8ff","items":["djzte0aqmudbb88jo448qe"],"ref":[]},"977zrwrwinb41yjrncg0et":{"id":"977zrwrwinb41yjrncg0et","name":"","description":"","color":"#ff80ab","items":["bmdf45dmf5jfz96rxkq10h"],"ref":[],"transient":true},"ycwwxs46gwnzama41koc":{"id":"ycwwxs46gwnzama41koc","name":"","description":"","color":"#ffffff","items":[],"ref":[],"transient":true},"8o3pww4qn1xq2luyz717c":{"id":"8o3pww4qn1xq2luyz717c","name":"","description":"","color":"#ff80ab","items":[],"ref":[],"transient":true},"yyuay36cjzf57s18hg0d5t":{"id":"yyuay36cjzf57s18hg0d5t","name":"","description":"","color":"#ff80ab","items":[],"ref":[],"transient":true},"4a07xdt072df7qw4tzvrjt":{"id":"4a07xdt072df7qw4tzvrjt","name":"","description":"","color":"#ff80ab","items":[],"ref":[],"transient":true},"djzte0aqmudbb88jo448qe":{"id":"djzte0aqmudbb88jo448qe","name":"","description":"","color":"#ff80ab","items":[],"ref":[],"transient":true},"bmdf45dmf5jfz96rxkq10h":{"id":"bmdf45dmf5jfz96rxkq10h","name":"","description":"","color":"#ff80ab","items":[],"ref":[],"transient":true},"7llyfbgu4eb9rae6kb074l":{"id":"7llyfbgu4eb9rae6kb074l","name":"I'm a task with links!","description":"","color":"#ff80ab","items":["jc0m3uxidpb1krerkvh3v2"],"ref":["9vk9ywmx4szziub8qxqo","ez1lvoo3dwkwmhdrh9s77"]},"7fv55sy73d7epp5kqnguul":{"id":"7fv55sy73d7epp5kqnguul","name":"","description":"","color":"#80d8ff","items":["v52993i59eby59317v6ejc"],"ref":[],"transient":true},"v52993i59eby59317v6ejc":{"id":"v52993i59eby59317v6ejc","name":"","description":"","color":"#80d8ff","items":[],"ref":[],"transient":true},"9ywa2zu4zgtbqz8v7sa2j":{"id":"9ywa2zu4zgtbqz8v7sa2j","name":"","description":"","color":"#ffffff","items":["7khopamf94pri5sb56dtwr"],"ref":[],"transient":true},"ez1lvoo3dwkwmhdrh9s77":{"id":"ez1lvoo3dwkwmhdrh9s77","name":"🐟 Easy","description":"","color":"#ffd180","items":["nmhbxh86d9gpf3zgxcv0e"],"ref":["7llyfbgu4eb9rae6kb074l"]},"34606nw061xmm5vbsi9r6c":{"id":"34606nw061xmm5vbsi9r6c","name":"","description":"","color":"#ffffff","items":[],"ref":[],"transient":true},"nmhbxh86d9gpf3zgxcv0e":{"id":"nmhbxh86d9gpf3zgxcv0e","name":"","description":"","color":"#ffffff","items":[],"ref":[],"transient":true},"7khopamf94pri5sb56dtwr":{"id":"7khopamf94pri5sb56dtwr","name":"","description":"","color":"#ffffff","items":[],"ref":[],"transient":true},"jc0m3uxidpb1krerkvh3v2":{"id":"jc0m3uxidpb1krerkvh3v2","name":"","description":"","color":"#ff80ab","items":["uw92fsodzs8scqpxraedd"],"ref":[],"transient":true},"uw92fsodzs8scqpxraedd":{"id":"uw92fsodzs8scqpxraedd","name":"","description":"","color":"#ff80ab","items":[],"ref":[],"transient":true},"ialkx35n6mo697qcqaulvl":{"id":"ialkx35n6mo697qcqaulvl","name":"","description":"","color":"#ffd180","items":["jb9zpt8uecbm04vlm2hg2h"],"ref":[],"transient":true},"jb9zpt8uecbm04vlm2hg2h":{"id":"jb9zpt8uecbm04vlm2hg2h","name":"","description":"","color":"#ffd180","items":[],"ref":[],"transient":true}});
  }

  private migrateRoot(root: any) {
    this.notes = {};

    this.top = root;
    this.migrateRootAdd(root);

    this.save();
    localStorage.setItem('version', '1');
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
