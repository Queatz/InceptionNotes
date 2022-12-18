import {Injectable} from '@angular/core'
import {Note} from './api.service'

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  byRef = [] as Array<Note>

  constructor() {
  }

  toggleRef(item: Note) {
    const i = this.byRef.indexOf(item)

    if (i === -1) {
      this.byRef.push(item)
    } else {
      this.byRef.splice(i, 1)
    }
  }
}
