import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  byRef = [] as Array<any>;

  constructor() { }

  toggleRef(item: any) {
    const i = this.byRef.indexOf(item);

    if (i === -1) {
      this.byRef.push(item);
    } else {
      this.byRef.splice(i, 1);
    }
  }
}
