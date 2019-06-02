import { Injectable } from '@angular/core';
import { UiService } from './ui.service';
import { ApiService } from './api.service';

import {
  CollaborativeJson,
  CollaborativeJsonAtom,
  CollaborativeJsonNode,
  ConflictResolution,
  ConflictResolver,
  Conflict
} from './collaborative-json';

const _sync: string = '_sync';

export class CollaborativeJsonString extends CollaborativeJsonAtom {}

export class CollaborativeJsonArray implements CollaborativeJsonNode {

  constructor(private api: ApiService) {}

  sync(key: string, node: Object, foreign: Object): boolean {
    if (node[key].length === foreign[key].length) {
      let equal = true;
      for (let i in node[key]) {
        if (node[key][i].id !== foreign[key][i].id) {
          equal = false;
          break;
        }
      }

      if (equal) {
        return true;
      }
    }

    return false;
  }

  set(key: string, node: Object, foreign: Object) {
    let all = this.api.getAllNotes();

    for (let i in foreign[key]) {
      let id = foreign[key][i].id;

      if (id in all) {
        node[key][i] = all[id];
      } else {
        node[key][i] = foreign[key][i];
      }
    }

    node[key].length = foreign[key].length;
  }
}

@Injectable()
export class CollaborateService {

  private collaborativeJson: CollaborativeJson;
  private conflictResolver: ConflictResolver;

  constructor(private ui: UiService, private api: ApiService) {
    this.collaborativeJson = new CollaborativeJson(_sync);
    this.collaborativeJson.addRule('name', new CollaborativeJsonString());
    this.collaborativeJson.addRule('description', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('checked', new CollaborativeJsonString());
    this.collaborativeJson.addRule('color', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('estimate', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('collapsed', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('backgroundUrl', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('items', new CollaborativeJsonArray(api));
    this.collaborativeJson.addRule('ref', new CollaborativeJsonArray(api));

    let diffStr = this.diffStr;

    this.conflictResolver = ({
      resolve(conflict: Conflict): Promise<ConflictResolution> {
        return new Promise<ConflictResolution>((resolve, reject) => {
          ui.dialog({
            message: 'Resolve conflict on ' + conflict.property + ':\n\nLocal copy:\n\n' + diffStr(conflict.local[conflict.property]) + '\n\nvs.\n\nRemote copy:\n\n' + diffStr(conflict.foreign[conflict.property]),
            ok: () => resolve(new ConflictResolution(true, conflict)),
            cancel: () => resolve(new ConflictResolution(false, conflict))
          });
        });
      }
    } as ConflictResolver);
  }

  public setSynchronized(node: Object, prop: string) {
    this.collaborativeJson.resolve(node, prop);
  }

  public sync(node: Object, foreign: Object) {
    return this.collaborativeJson.sync(node, foreign, this.conflictResolver);
  }

  public syncAll(node: any, foreign: any) {
    let needsMerge: Array<any> = [];
    let promise: Promise<boolean> = Promise.resolve(true);

    for(let key in foreign) {
      if (key in node) {
        promise = promise.then(() => this.sync(node[key], foreign[key]));
      } else {
        node[key] = foreign[key];

        if (!node[key].parent && node[key].name.replace(/<(?:.|\n)*?>/gm, '').trim().length) {
          this.api.moveList(node[key].id, this.api.getShow().id);
        }
      }
    }

    return promise;
  }

  public diffStr(obj: any) {
    if (typeof(obj) === 'string') {
      return obj;
    } else if (Array.isArray(obj)) {
      return obj.reduce((val, item) => val + '\n' + item.name, '');
    } else {
      return obj;
    }
  }
}
