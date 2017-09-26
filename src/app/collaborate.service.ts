import { Injectable } from '@angular/core';
import { UiService } from './ui.service';
import { ApiService } from './api.service';

import {
  CollaborativeJson,
  CollaborativeJsonString,
  CollaborativeJsonAtom,
  CollaborativeJsonArray,
  ConflictResolution,
  ConflictResolver,
  Conflict
} from './collaborative-json';

const _sync: string = '_sync';

@Injectable()
export class CollaborateService {

  private collaborativeJson: CollaborativeJson;
  private conflictResolver: ConflictResolver;

  constructor(private ui: UiService, private api: ApiService) {
    this.collaborativeJson = new CollaborativeJson(_sync);
    this.collaborativeJson.addRule('name', new CollaborativeJsonString());
    this.collaborativeJson.addRule('description', new CollaborativeJsonString());
    this.collaborativeJson.addRule('color', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('backgroundUrl', new CollaborativeJsonAtom());
    this.collaborativeJson.addRule('items', new CollaborativeJsonArray());

    this.conflictResolver = ({
      resolve(conflict: Conflict): Promise<ConflictResolution> {
        return new Promise<ConflictResolution>((resolve, reject) => {
          ui.dialog({
            message: 'Resolve conflict on ' + conflict.property + ':\n\n' + conflict.local[conflict.property] + '\nvs.\n' + conflict.foreign[conflict.property],
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
}
