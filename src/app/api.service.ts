// tslint:disable:max-line-length

import {Injectable} from '@angular/core'
import {Router} from '@angular/router'
import {UiService} from './ui.service'
import {Subject} from 'rxjs'
import {Config} from 'app/config.service'

export class Invitation {
  id: string
  name: string
  token?: string
  isSteward: boolean
}

export class NoteOptions {
  enumerate?: boolean
  invertText?: boolean
}

export class Note {
  id: string
  rev: string
  parent?: Note
  name: string
  steward: string
  description: string | null
  checked: boolean
  color: string
  items: Note[]
  ref: Note[]
  invitations: Invitation[]
  options: NoteOptions
  backgroundUrl: string
  collapsed: boolean
  estimate: number
  created: string
  updated?: string
  _local?: string[]
}

export class FrozenNote {
  id: string
  rev: string
  parent?: FrozenNote
  name: string
  steward: string
  description: string
  checked: boolean
  color: string
  items: string[]
  ref: string[]
  invitations: string[]
  options: NoteOptions
  backgroundUrl: string
  collapsed: boolean
  estimate: number
  created: string
  updated?: string
  _local?: string[]
}

export class NoteChanges {
  public note: Note
  public property: string

  constructor(note: any, property: string) {
    this.note = note
    this.property = property
  }
}

export class ViewConfig {
  eye: Note
  show: Note
  parents: Note[]
}

@Injectable()
export class ApiService {

  private top: Note
  private notes: Map<string, Note>
  private invitations: Map<string, Invitation>

  private view: ViewConfig = {
    eye: null,
    show: null,
    parents: []
  }

  public onNoteChangedObservable: Subject<NoteChanges> = new Subject<NoteChanges>()
  public onViewChangedObservable: Subject<ViewConfig> = new Subject<ViewConfig>()

  constructor(private ui: UiService, private config: Config, private router: Router) {
    this.invitations = new Map<string, Invitation>()
    this.load()
  }

  /* Persistence */

  save() {
    localStorage.setItem('top', this.top.id)
  }

  load() {
    const version = +localStorage.getItem('version')
    let root = null

    if (version < 1) {
      root = JSON.parse(localStorage.getItem('root'))
    }

    if (root) {
      this.backupToFile(localStorage.getItem('root'))
      this.migrateRoot(root)

      setTimeout(() => {
        this.ui.dialog({
          message: 'Inception Notes has received an update.\n\nA backup copy of notes have been downloaded. If all else fails, check Right Click -> Inspect -> Application (tab) -> Local Storage -> \'root\''
        })
      }, 1000)
    }

    if (version < 2) {
      localStorage.setItem('version', '2')
      this.notes = this.unfreeze(localStorage.getItem('notes'))
      this.saveAll()
    }

    const localNotes = new Map<string, FrozenNote | Note>()

    for (const n in localStorage) {
      if (n.substring(0, 5) === 'note:') {
        const n2 = JSON.parse(localStorage.getItem(n))
        localNotes.set(n2.id, n2)
      } else if (n.substring(0, 11) === 'invitation:') {
        this.updateInvitation(JSON.parse(localStorage.getItem(n)))
      }
    }

    if (localNotes.size) {
      for (const n of localNotes.values()) {
        this.unfreezeNote(n as FrozenNote, localNotes)
      }

      this.notes = localNotes as Map<string, Note>
      this.resetView()
    } else {
      this.intro()
    }

    this.observeStorage()
  }

  private observeStorage() {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key.startsWith('note:')) {
        this.loadNote(event.newValue)
      }
    })
  }

  saveAll() {
    if (!this.notes) {
      return
    }

    for (const note of this.notes.values()) {
      this.saveNote(note)
    }
  }

  /**
   * Load a single note.
   */
  loadNote(note: string) {
    const n = JSON.parse(note)
    const existingNote = this.notes.get(n.id)

    if (!n.id) {
      return
    }

    this.unfreezeNote(n as FrozenNote, this.notes)

    if (existingNote) {
      this.updateNote(existingNote, n)
    } else {
      this.notes.set(n.id, n)
    }
  }

  private updateNote(note: Note, referenceNote: Note) {
    note.name = referenceNote.name
    note.rev = referenceNote.rev
    note.description = referenceNote.description
    note.color = referenceNote.color
    note.estimate = referenceNote.estimate
    note.checked = referenceNote.checked
    note.backgroundUrl = referenceNote.backgroundUrl
    note.collapsed = referenceNote.collapsed
    note.ref = referenceNote.ref
    note.invitations = referenceNote.invitations
    note.items = referenceNote.items
    note.options = Object.assign({}, referenceNote.options)
    note.created = referenceNote.created
    note.updated = referenceNote.updated
    note._local = referenceNote._local ? [ ...referenceNote._local ] : note._local

    // Update parent references, note that 'ref' should be updated by the other note anyway
    note.items.forEach(n => {
      n.parent = note
    })

    // Don't mark note as modified, since this flow is only used for cross-tab sync
  }

  /**
   * Save a single note
   */
  saveNote(note: Note) {
    localStorage.setItem('note:' + note.id, JSON.stringify(this.freezeNote(note)))
  }

  private freeze(animal: Map<string, Note>): string {
    if (!animal) {
      return null
    }

    const fossil = {}

    for (const a of animal.values()) {
      fossil[a.id] = this.freezeNote(a)
    }

    return JSON.stringify(fossil)
  }

  unfreeze(fossil: object | string): Map<string, Note> {
    if (typeof (fossil) === 'string') {
      fossil = JSON.parse(fossil)
    }

    if (!fossil) {
      return null
    }

    const map = new Map<string, FrozenNote | Note>()

    for (const x of Object.keys(fossil)) {
      map.set(x, fossil[x])
    }

    for (const a of map.values()) {
      this.unfreezeNote(a as FrozenNote, map)
    }

    return map as Map<string, Note>
  }

  /**
   * Semi-freeze a single note
   */
  freezeNote(a: Partial<Note>, forServer = false): FrozenNote {
    let items: string[]
    if (a.items) {
      items = []
      for (const item of a.items) {
        items.push(item.id)
      }
    }

    let ref: string[]
    if (a.ref) {
      ref = []
      for (const item of a.ref) {
        ref.push(item.id)
      }
    }

    let invitations: string[]
    if (a.invitations) {
      invitations = []
      for (const invitation of a.invitations) {
        invitations.push(invitation.id)
      }
    }

    return {
      id: a.id,
      rev: a.rev,
      name: a.name,
      steward: a.steward,
      description: a.description,
      checked: a.checked,
      color: a.color,
      items,
      ref,
      invitations,
      options: a.options,
      backgroundUrl: a.backgroundUrl,
      collapsed: a.collapsed,
      estimate: a.estimate,
      created: a.created,
      updated: a.updated,
      ...(!forServer ? { _local: a._local } : {})
    }
  }

  /**
   * Unfreeze a note
   *
   * @param a The currently semi-frozen note
   * @param fossils A pool of semi-frozen notes
   */
  unfreezeNote(a: FrozenNote | Note, fossils: Map<string, FrozenNote | Note>) {
    const note: Note = a as Note

    const items = a.items
    a.items = []

    if (items) {
      for (const id of items) {
        let n = fossils.get(id as string)

        if (!n) {
          if (this.config.beta) {
            console.log('unfreeze error: missing note \'' + id + '\'')
          }
          n = this.newBlankNote(true, id as string)
        }

        note.items.push(n as Note)
        n.parent = note
      }
    }

    const ref = a.ref

    if (ref) {
      note.ref = []
      for (const id of ref) {
        let n = fossils.get(id as string)

        if (!n) {
          if (this.config.beta) {
            console.log('unfreeze error: missing note \'' + id + '\'')
          }
          n = this.newBlankNote(true, id as string)
        }

        note.ref.push(n as Note)
      }
    }

    if (a.invitations) {
      const invitations = a.invitations
      note.invitations = []
      for (const id of invitations) {
        const n = this.invitation(id as string)
        note.invitations.push(n)
      }
    }
  }

  /**
   * Unfreeze a property
   */
  unfreezeProp(note: Note, prop: string, value: any) {
    if (['invitations', 'ref', 'items'].indexOf(prop) !== -1) {
      if (!value) {
        return []
      }

      const a = []

      if (prop === 'invitations') {
        for (const id of value) {
          a.push(this.invitation(id))
        }

        return a
      } else {
        for (const id of value) {
          let item = this.search(id)

          if (!item) {
            item = this.newBlankNote(true, id)
            item.color = note.color
            this.saveNote(item)
          }

          a.push(item)

          if (prop === 'items') {
            item.parent = note
          }
        }

        return a
      }
    }

    return value
  }

  /* Invitations */

  /**
   * Get an invitation by id
   */
  invitation(id: string): Invitation {
    if (this.invitations.has(id)) {
      return this.invitations.get(id)
    }

    const p: Invitation = new Invitation()
    p.id = id
    this.invitations.set(id, p)
    return p
  }

  updateInvitation(invitation: Invitation): Invitation {
    if (!invitation?.id) {
      return
    }

    const p = this.invitation(invitation.id)
    p.name = invitation.name
    p.isSteward = invitation.isSteward
    p.token = invitation.token
    localStorage.setItem('invitation:' + invitation.id, JSON.stringify(p))
    return p
  }

  addInvitationToNote(note: Note, invitation: Invitation) {
    invitation = this.invitation(invitation.id)

    if (!note.invitations) {
      note.invitations = []
    }

    if (note.invitations.indexOf(invitation) !== -1) {
      return
    }

    note.invitations.push(invitation)
    this.modified(note, 'invitations')
  }

  /* View */

  up() {
    if (this.view.eye === this.view.show) {
      const eye = this.search(this.view.show.id)

      if (!eye || !this.parents(eye).length) {
        this.ui.dialog({
          message: 'Create new list containing this one?',
          ok: () => this.breakCeiling()
        })
        return
      }

      const parents = this.parents(eye)
      const show = parents[parents.length - 1]
      this.view.eye = show
      this.view.show = show
    } else {
      const show = this.search(this.view.show.id)

      if (!show || !show.parent) {
        return
      }

      this.view.show = show.parent
    }

    this.saveView()
  }

  resetView() {
    const top = localStorage.getItem('top')

    if (top) {
      this.top = this.notes.get(top)
    } else {
      for (const note of this.notes.values()) {
        this.top = note
        break
      }
    }

    const viewId = localStorage.getItem('view')
    const showId = localStorage.getItem('view-show') || viewId

    const view = this.search(viewId)
    const show = this.search(showId)

    if (view) {
      this.view.eye = view
      this.view.show = show
    } else {
      this.view.eye = this.view.show = this.top
    }
  }

  getEye() {
    return this.view.eye
  }

  setEye(eye: Note) {
    this.view.eye = eye
    this.view.show = this.view.eye
    this.saveView()
  }

  getShow() {
    return this.view.show
  }

  setShow(show: Note) {
    this.view.show = show
    this.saveView()
  }

  private saveView() {
    this.router.navigate(['n', this.view.show.id])
    localStorage.setItem('view', this.view.eye.id)
    localStorage.setItem('view-show', this.view.show.id)

    this.onViewChangedObservable.next(this.view)
  }

  /* Etc */

  getAllNotes(): Map<string, Note> {
    return this.notes
  }

  getFrozenNotes() {
    return this.freeze(this.notes)
  }

  getRoot() {
    return this.top
  }

  getLists() {
    return this.top.items
  }

  search(id: string): Note {
    return this.notes.get(id)
  }

  private parents(note: Note) {
    const list = []

    if (!note) {
      return list
    }

    while (note.parent && !list.includes(note.parent)) {
      list.unshift(note.parent)
      note = note.parent
    }

    return list
  }

  contains(id: string, note: Note, exclude: Note[] = null) {
    if (!note || !note.items) {
      return false
    }

    if (note.id === id) {
      return true
    }

    if (!exclude) {
      exclude = []
    }

    if (exclude.indexOf(note) !== -1) {
      return true
    }

    exclude.push(note)

    for (const subItem of note.items) {
      if (this.contains(id, subItem, exclude)) {
        return true
      }
    }

    return false
  }

  getSubItemEstimates(item: Note, exclude: Note[] = null): Array<number> {
    let result: Array<number> = []

    if (!exclude) {
      exclude = []
    }

    if (exclude.indexOf(item) !== -1) {
      return result
    }

    if (item.estimate) {
      result.push(item.estimate)
    }

    exclude.push(item)

    for (const subItem of item.items) {
      result = result.concat(this.getSubItemEstimates(subItem, exclude))
    }

    return result
  }

  getSubItemNames(item: Note, exclude: Note[] = null): Array<string> {
    let result: Array<string> = []

    if (!exclude) {
      exclude = []
    }

    if (exclude.indexOf(item) !== -1) {
      return result
    }

    exclude.push(item)

    for (const subItem of item.items) {
      if (!subItem.name) {
        continue
      }

      result.push(subItem.name)
      result = result.concat(this.getSubItemNames(subItem, exclude))
    }

    return result
  }

  /* Synchronization */

  loadFrozenNotes(notes: string): void {
    const n = this.unfreeze(notes)

    for (const note of n.keys()) {
      const nn = n.get(note)
      this.notes.set(note, nn)

      if (nn.name.replace(/<(?:.|\n)*?>/gm, '').trim().length && !nn.parent) {
        this.getEye().items.push(nn)
      }
    }

    this.saveAll()
    this.resetView()
  }

  /* Backup */

  backup() {
    this.backupToFile(this.freeze(this.notes))

    this.ui.getEnv().lastBackup = new Date().toLocaleDateString()
    this.ui.save()
  }

  unbackup() {
    this.ui.dialog({
      message: 'Notes will be loaded to their previous state.\n\nYou may lose notes.\n\nProceed?',
      ok: () => this.performUnbackup()
    })
  }

  private performUnbackup() {
    const dlAnchorElem = (document.createElement('INPUT') as HTMLInputElement)
    dlAnchorElem.type = 'file'
    dlAnchorElem.onchange = () => {
      const fr = new FileReader()
      fr.onloadend = () => {
        this.loadFrozenNotes(fr.result as string)
      }
      fr.readAsText(dlAnchorElem.files[0])
    }
    dlAnchorElem.click()
  }

  backupToFile(str: string) {
    const dateStr = new Date().toLocaleDateString()
    const dataStr = new Blob([str], {type: 'application/json'})
    const dlAnchorElem = (document.createElement('A') as HTMLAnchorElement)
    dlAnchorElem.href = window.URL.createObjectURL(dataStr)
    dlAnchorElem.setAttribute('download', 'Inception Notes (' + dateStr + ').json')
    document.body.appendChild(dlAnchorElem)
    dlAnchorElem.click()
    document.body.removeChild(dlAnchorElem)
  }

  /* Edit */

  modified(note: Note, prop: string = null) {
    if (prop === null) {
      delete note._local
    } else if (note._local && note._local.indexOf(prop) === -1) {
      note._local.push(prop)
    }

    note.updated = new Date().toISOString()

    this.saveNote(note)
    this.onNoteChangedObservable.next(new NoteChanges(note, prop))
  }

  /**
   * Set a note prop as synced.
   */
  setSynced(id: string, prop: string) {
    const note = this.search(id)

    if (!note) {
      if (this.config.beta) {
        console.log('Cannot set note as synced: ' + id)
      }
      return
    }

    this.setPropSynced(note, prop)
    this.saveNote(note)
  }

  /**
   * Set all props synced
   */
  setAllPropsSynced(note: Note) {
    note._local = []
    this.saveNote(note)
  }

  setNoteRev(id: string, rev: string): boolean {
    const note = this.search(id)

    if (note) {
      note.rev = rev
      this.setAllPropsSynced(note)
      return true
    }

    return false
  }

  /**
   * setPropSynced
   */
  setPropSynced(note: Note, prop: string) {
    // This entire note is not synced yet
    if (!note._local) {
      return
    }

    const index = note._local.indexOf(prop)

    if (index !== -1) {
      note._local.splice(index, 1)
    }
  }

  isSynced(note: Note, prop: string): boolean {
    return note._local && (note._local.indexOf(prop) === -1)
  }

  /**
   * Create a new note containing the top note
   */
  private breakCeiling() {
    const id = this.newId()

    const newTop: Note = {
      id: id,
      name: 'New Master List',
      description: '',
      color: '#ffffff',
      items: [this.top]
    } as Note

    this.top.parent = newTop
    this.top = newTop

    this.notes.set(id, this.top)

    this.view.eye = this.view.show = this.top
    this.saveView()
    this.modified(newTop)
  }

  moveListUp(list: Note, position: number = -1) {
    const parents = this.parents(list)
    const parent = parents.length >= 2 ? parents[parents.length - 2] : null

    if (!parent) {
      return
    }

    if (position !== -1) {
      this.moveListToPosition(list.id, parent.id, position)
    } else {
      this.moveList(list.id, parent.id)
    }
  }

  moveList(listId: string, toListId: string) {
    this.moveListToPosition(listId, toListId, -1)
  }

  moveListToPosition(listId: string, toListId: string, position: number) {
    if (listId === toListId) {
      return
    }

    const list = this.search(listId)
    const toList = this.search(toListId)

    if (!list || !toList) {
      this.ui.dialog({
        message: 'List could not be found.'
      })

      return
    }

    const listParents = this.parents(list)
    const toListParents = this.parents(toList)

    const listParent = listParents.length ? listParents[listParents.length - 1] : null

    if (listParent !== toList) {
      for (const parent of toListParents) {
        if (parent.id === listId) {
          this.ui.dialog({
            message: 'List cannot be moved into a child of itself.'
          })

          return
        }
      }
    }

    let oldPos = null

    if (listParent) {
      oldPos = listParent.items.indexOf(list)

      listParent.items.splice(oldPos, 1)
      this.modified(listParent, 'items')
    }

    if (toList === listParent && oldPos < position) {
      position--
    }

    if (position < 0) {
      // @ts-ignore findLastIndex
      position = toList.items.findLastIndex((item: Note) => !item.name)
    }

    if (position >= 0 && position < toList.items.length) {
      toList.items.splice(position, 0, list)
    } else {
      toList.items.push(list)
    }

    this.modified(toList, 'items')

    list.parent = toList
  }

  removeListFromParent(list: Note) {
    if (list.parent) {
      const pos = list.parent.items.indexOf(list)
      if (pos >= 0) {
        list.parent.items.splice(pos, 1)
        this.modified(list.parent, 'items')
        list.parent = null
      }
    }
  }

  duplicateList(list: Note) {
    if (!list.parent) {
      return
    }

    const newList = this.newBlankList(list.parent, list.parent.items.indexOf(list) + 1)

    this.copyFromNote(newList, list, true)

    this.modified(list.parent, 'items')
    this.modified(newList)

    return newList
  }

  copyFromNote(note: Note, referenceNote: Note, includeItems = false) {
    note.name = referenceNote.name
    note.description = referenceNote.description
    note.color = referenceNote.color
    note.estimate = referenceNote.estimate
    note.checked = referenceNote.checked
    note.backgroundUrl = referenceNote.backgroundUrl
    note.collapsed = referenceNote.collapsed
    note.options = Object.assign({}, referenceNote.options)

    if (referenceNote.ref?.length) {
      referenceNote.ref.forEach(ref => {
        this.addRef(note, ref)
      })
    }

    if (includeItems) {
      referenceNote.items.forEach(item => {
        const newItem = this.newBlankList(note)
        this.copyFromNote(newItem, item, includeItems)
      })
    }

    this.modified(note)
  }

  newBlankList(list: Note = null, position: number = null) {
    const note: Note = this.newBlankNote()

    if (list) {
      note.parent = list

      if (position === null) {
        list.items.push(note)
      } else {
        list.items.splice(position, 0, note)
      }

      const synced = this.isSynced(list, 'items')
      this.modified(list, 'items')
      if (synced) {
        this.setPropSynced(list, 'items')
      }
    }

    return note
  }

  newBlankNote(fromServer?: boolean, id?: string): Note {
    if (!id) {
      id = this.newId()
    }

    const note: Note = {
      id: id,
      name: '',
      description: '',
      color: '#ffffff',
      items: [],
      created: new Date().toISOString()
    } as Note

    if (this.notes) {
      this.notes.set(note.id, note)
    }

    if (fromServer) {
      this.setAllPropsSynced(note)
    }

    return note
  }

  /* Relationships */

  addRef(list: Note, toList: Note) {
    if (list === toList) {
      return
    }

    if (!toList.ref) {
      toList.ref = []
    }

    if (!list.ref) {
      list.ref = []
    }

    if (toList.ref.indexOf(list) !== -1) {
      return
    }

    if (list.ref.indexOf(toList) !== -1) {
      return
    }

    toList.ref.push(list)
    this.modified(toList, 'ref')

    list.ref.push(toList)
    this.modified(list, 'ref')
  }

  removeRef(list: Note, toList: Note) {
    if (list === toList) {
      return
    }

    if (toList.ref) {
      const idx = toList.ref.indexOf(list)

      if (idx !== -1) {
        toList.ref.splice(idx, 1)
        this.modified(toList, 'ref')
      }
    }

    if (list.ref) {
      const idx = list.ref.indexOf(toList)

      if (idx !== -1) {
        list.ref.splice(idx, 1)
        this.modified(list, 'ref')
      }
    }
  }

  orderRef(list: Note, toList: Note, position: number) {
    if (list === toList) {
      return
    }

    if (list.ref) {
      const idx = list.ref.indexOf(toList)

      if (idx !== -1) {
        list.ref.splice(idx, 1)

        if (position < 0) {
          list.ref.splice(list.ref.length - position, 0, toList)
        } else {
          list.ref.splice(position, 0, toList)
        }

        this.modified(list, 'ref')
      }
    }
  }

  changeRef(list: Note, refToRemove: Note, newRef: Note) {
    if (list === newRef) {
      return
    }

    if (!newRef.ref) {
      newRef.ref = []
    }

    if (!list.ref) {
      list.ref = []
    }

    if (newRef.ref.indexOf(list) !== -1) {
      return
    }

    if (list.ref.indexOf(newRef) !== -1) {
      return
    }

    const listPos = list.ref.indexOf(refToRemove)

    if (listPos === -1) {
      return
    }

    const listPosOldRef = refToRemove.ref.indexOf(list)

    if (listPosOldRef === -1) {
      return
    }

    list.ref.splice(listPos, 1, newRef)
    this.modified(list, 'ref')

    newRef.ref.push(list)
    this.modified(newRef, 'ref')

    refToRemove.ref.splice(listPosOldRef, 1)
    this.modified(refToRemove, 'ref')
  }

  /* Recents */

  getRecent(which: string): Note[] {
    const recent = localStorage.getItem('recent::' + which)

    if (!recent) {
      return []
    }

    return recent.split(',').map(noteId => this.search(noteId)).filter(note => !!note)
  }

  addRecent(which: string, noteId: string) {
    const recents = (localStorage.getItem('recent::' + which) || '').split(',').filter(n => n !== noteId)
    recents.unshift(noteId)
    if (recents.length > 3) {
      recents.length = 3
    }
    localStorage.setItem('recent::' + which, recents.join(','))
  }

  /* Util */

  newId() {
    let id

    do {
      id = this.rawNewId()
    } while (this.notes?.has(id))

    return id
  }

  rawNewId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  invitationColor(id: string) {
    if (!id) { return '#404040' }
    return `hsl(${id.split('').map(it => it.charCodeAt(0)).reduce((a, b, i) => a * (i + 1) + b * (i + 1)) % 360}, 66%, 33%)`
  }

  private intro() {
    const notes = this.unfreeze(
      {
        '9ecal36r08qsegt2q7ruar': {
          'id': '9ecal36r08qsegt2q7ruar',
          'name': 'My Notes',
          'description': 'Take notes here...',
          'color': '#80d8ff',
          'items': ['ezyw5zl0s7k5ky66oz7368', 'tprx0gv41gepcofy7yia', 'tpot361b974p1mn3jxbr4', '7fv55sy73d7epp5kqnguul'],
          'ref': []
        } as FrozenNote,
        'ezyw5zl0s7k5ky66oz7368': {
          'id': 'ezyw5zl0s7k5ky66oz7368',
          'name': 'Welcome to Inception Notes!',
          'description': '',
          'color': '#ff80ab',
          'items': ['3ooxxyu6ko97smbzcigvza', '7llyfbgu4eb9rae6kb074l', 's3flakxhf2mb8pixx0w1l', 'isqms385v5batkjoztpn15'],
          'ref': []
        } as FrozenNote,
        '3ooxxyu6ko97smbzcigvza': {
          'id': '3ooxxyu6ko97smbzcigvza',
          'name': '<b>Right-click</b> on the background to get help',
          'description': '',
          'color': '#ff8a80',
          'items': ['r8um73em8ikjy1847ituem'],
          'ref': []
        } as FrozenNote,
        'r8um73em8ikjy1847ituem': {
          'id': 'r8um73em8ikjy1847ituem',
          'name': '',
          'color': '#ffffff',
          'items': ['do7uegwh31lf6qu8lxpye'],
          'ref': []
        } as FrozenNote,
        'do7uegwh31lf6qu8lxpye': {'id': 'do7uegwh31lf6qu8lxpye', 'name': '', 'color': '#ffffff', 'items': [], 'ref': []} as FrozenNote,
        's3flakxhf2mb8pixx0w1l': {
          'id': 's3flakxhf2mb8pixx0w1l',
          'name': 'Have fun!',
          'description': '',
          'color': '#ea80fc',
          'items': ['rjq9391912ae63xb2e8y'],
          'ref': []
        } as FrozenNote,
        'rjq9391912ae63xb2e8y': {
          'id': 'rjq9391912ae63xb2e8y',
          'name': '',
          'color': '#ffffff',
          'items': ['rgmgxz8fabchssd0j75acb'],
          'ref': []
        } as FrozenNote,
        'rgmgxz8fabchssd0j75acb': {
          'id': 'rgmgxz8fabchssd0j75acb',
          'name': '',
          'color': '#ffffff',
          'items': [],
          'ref': []
        } as FrozenNote,
        'isqms385v5batkjoztpn15': {
          'id': 'isqms385v5batkjoztpn15',
          'name': '',
          'color': '#ffffff',
          'items': ['w0ok2ypdxqugorshz54l'],
          'ref': []
        } as FrozenNote,
        'w0ok2ypdxqugorshz54l': {'id': 'w0ok2ypdxqugorshz54l', 'name': '', 'color': '#ffffff', 'items': [], 'ref': []} as FrozenNote,
        'tprx0gv41gepcofy7yia': {
          'id': 'tprx0gv41gepcofy7yia',
          'name': 'Main Projects',
          'description': '',
          'color': '#ffd180',
          'items': ['bxw7hfpcmytcq0738o31ef', 'rbcx2x3og4b2ty3efm4aux', 'whfs7lj4i5gzrdyifbt4td', '7oknreb5imgufsn1ohxcib', 'ialkx35n6mo697qcqaulvl'],
          'ref': []
        } as FrozenNote,
        'bxw7hfpcmytcq0738o31ef': {
          'id': 'bxw7hfpcmytcq0738o31ef',
          'name': 'My First Project',
          'description': '',
          'color': '#E6E3D7',
          'items': ['di8colqbb8lyyvf5gidqqj'],
          'ref': []
        } as FrozenNote,
        'di8colqbb8lyyvf5gidqqj': {
          'id': 'di8colqbb8lyyvf5gidqqj',
          'name': '',
          'color': '#ffffff',
          'items': ['t6tdhnfx3ydzbvul20lti'],
          'ref': []
        } as FrozenNote,
        't6tdhnfx3ydzbvul20lti': {'id': 't6tdhnfx3ydzbvul20lti', 'name': '', 'color': '#ffffff', 'items': [], 'ref': []} as FrozenNote,
        'rbcx2x3og4b2ty3efm4aux': {
          'id': 'rbcx2x3og4b2ty3efm4aux',
          'name': 'My Other Project',
          'description': '',
          'color': '#E6E3D7',
          'items': ['pl7mhv8mjxqs48qw1n3ku'],
          'ref': []
        } as FrozenNote,
        'pl7mhv8mjxqs48qw1n3ku': {
          'id': 'pl7mhv8mjxqs48qw1n3ku',
          'name': '',
          'color': '#ffffff',
          'items': ['yvnljwa9yhhqk3pqztuwh'],
          'ref': []
        } as FrozenNote,
        'yvnljwa9yhhqk3pqztuwh': {'id': 'yvnljwa9yhhqk3pqztuwh', 'name': '', 'color': '#ffffff', 'items': [], 'ref': []} as FrozenNote,
        'whfs7lj4i5gzrdyifbt4td': {
          'id': 'whfs7lj4i5gzrdyifbt4td',
          'name': 'Big project!',
          'color': '#ff80ab',
          'items': ['0xbh8qf3zrnfjfl0ibldk1', 'eeg9e8s76diffzstgsuch', 'ci0zuqdnygdbqbcw7g74tp', 'ftard0ob3qvu6yeinge5hr', '977zrwrwinb41yjrncg0et'],
          'ref': []
        } as FrozenNote,
        '0xbh8qf3zrnfjfl0ibldk1': {
          'id': '0xbh8qf3zrnfjfl0ibldk1',
          'name': 'First task',
          'color': '#ffffff',
          'items': ['ycwwxs46gwnzama41koc'],
          'ref': [],
          'estimate': 2
        } as FrozenNote,
        'tpot361b974p1mn3jxbr4': {
          'id': 'tpot361b974p1mn3jxbr4',
          'name': 'My Reminders',
          'description': '',
          'color': '#b9f6ca ',
          'items': ['uc54p4plm19f9sgnnwux3i', 'isfiozt8g5ppt4y4u9hni', '2b05yurzcc6z0au55zknfc'],
          'ref': []
        } as FrozenNote,
        'uc54p4plm19f9sgnnwux3i': {
          'id': 'uc54p4plm19f9sgnnwux3i',
          'name': 'Clean room',
          'description': '',
          'color': '#D7E6D9',
          'items': ['1pxfcxl9yxpop7cu9nnu2e'],
          'ref': []
        } as FrozenNote,
        '1pxfcxl9yxpop7cu9nnu2e': {
          'id': '1pxfcxl9yxpop7cu9nnu2e',
          'name': '',
          'color': '#ffffff',
          'items': ['tut1poxh5ejbn9429bc9'],
          'ref': []
        } as FrozenNote,
        'tut1poxh5ejbn9429bc9': {'id': 'tut1poxh5ejbn9429bc9', 'name': '', 'color': '#ffffff', 'items': [], 'ref': []} as FrozenNote,
        'isfiozt8g5ppt4y4u9hni': {
          'id': 'isfiozt8g5ppt4y4u9hni',
          'name': 'Go for a run',
          'description': '',
          'color': '#D7E6D9',
          'items': ['mhnttcm1ca3hd7cnvxg8a'],
          'ref': []
        } as FrozenNote,
        'mhnttcm1ca3hd7cnvxg8a': {
          'id': 'mhnttcm1ca3hd7cnvxg8a',
          'name': '',
          'color': '#ffffff',
          'items': ['zuo967kb1dsecaunq3eszq'],
          'ref': []
        } as FrozenNote,
        'zuo967kb1dsecaunq3eszq': {
          'id': 'zuo967kb1dsecaunq3eszq',
          'name': '',
          'color': '#ffffff',
          'items': [],
          'ref': []
        } as FrozenNote,
        '2b05yurzcc6z0au55zknfc': {
          'id': '2b05yurzcc6z0au55zknfc',
          'name': '',
          'color': '#ffffff',
          'items': ['qc12atkaitmosp34yv95c'],
          'ref': []
        } as FrozenNote,
        'qc12atkaitmosp34yv95c': {'id': 'qc12atkaitmosp34yv95c', 'name': '', 'color': '#ffffff', 'items': [], 'ref': []} as FrozenNote,
        '7oknreb5imgufsn1ohxcib': {
          'id': '7oknreb5imgufsn1ohxcib',
          'name': 'My Categories',
          'color': '#ffffff',
          'items': ['9vk9ywmx4szziub8qxqo', 'ez1lvoo3dwkwmhdrh9s77', '9ywa2zu4zgtbqz8v7sa2j'],
          'ref': []
        } as FrozenNote,
        '9vk9ywmx4szziub8qxqo': {
          'id': '9vk9ywmx4szziub8qxqo',
          'name': '🐊 Fun',
          'color': '#80d8ff',
          'items': ['34606nw061xmm5vbsi9r6c'],
          'ref': ['7llyfbgu4eb9rae6kb074l']
        } as FrozenNote,
        'jugi69kmkhdq0k459wehn': {
          'id': 'jugi69kmkhdq0k459wehn',
          'name': '',
          'description': '',
          'color': '#ffd180',
          'items': ['ym01shouprrrrfsnxmzh'],
          'ref': []
        } as FrozenNote,
        'ym01shouprrrrfsnxmzh': {
          'id': 'ym01shouprrrrfsnxmzh',
          'name': '',
          'description': '',
          'color': '#ffd180',
          'items': [],
          'ref': []
        } as FrozenNote,
        'ftard0ob3qvu6yeinge5hr': {
          'id': 'ftard0ob3qvu6yeinge5hr',
          'name': 'Bonus task!',
          'description': '',
          'color': '#ff80ab',
          'items': ['4a07xdt072df7qw4tzvrjt'],
          'ref': [],
          'estimate': 1
        } as FrozenNote,
        'eeg9e8s76diffzstgsuch': {
          'id': 'eeg9e8s76diffzstgsuch',
          'name': 'Second task',
          'description': '',
          'color': '#ff80ab',
          'items': ['8o3pww4qn1xq2luyz717c'],
          'ref': [],
          'estimate': 2
        } as FrozenNote,
        'ci0zuqdnygdbqbcw7g74tp': {
          'id': 'ci0zuqdnygdbqbcw7g74tp',
          'name': 'Third task',
          'description': '',
          'color': '#ff80ab',
          'items': ['yyuay36cjzf57s18hg0d5t'],
          'ref': [],
          'estimate': 4
        } as FrozenNote,
        '163j3kckevih3kmtfqkstf9': {
          'id': '163j3kckevih3kmtfqkstf9',
          'name': '<br>',
          'description': '',
          'color': '#80d8ff',
          'items': ['djzte0aqmudbb88jo448qe'],
          'ref': []
        } as FrozenNote,
        '977zrwrwinb41yjrncg0et': {
          'id': '977zrwrwinb41yjrncg0et',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': ['bmdf45dmf5jfz96rxkq10h'],
          'ref': []
        } as FrozenNote,
        'ycwwxs46gwnzama41koc': {
          'id': 'ycwwxs46gwnzama41koc',
          'name': '',
          'description': '',
          'color': '#ffffff',
          'items': [],
          'ref': []
        } as FrozenNote,
        '8o3pww4qn1xq2luyz717c': {
          'id': '8o3pww4qn1xq2luyz717c',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': [],
          'ref': []
        } as FrozenNote,
        'yyuay36cjzf57s18hg0d5t': {
          'id': 'yyuay36cjzf57s18hg0d5t',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': [],
          'ref': []
        } as FrozenNote,
        '4a07xdt072df7qw4tzvrjt': {
          'id': '4a07xdt072df7qw4tzvrjt',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': [],
          'ref': []
        } as FrozenNote,
        'djzte0aqmudbb88jo448qe': {
          'id': 'djzte0aqmudbb88jo448qe',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': [],
          'ref': []
        } as FrozenNote,
        'bmdf45dmf5jfz96rxkq10h': {
          'id': 'bmdf45dmf5jfz96rxkq10h',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': [],
          'ref': []
        } as FrozenNote,
        '7llyfbgu4eb9rae6kb074l': {
          'id': '7llyfbgu4eb9rae6kb074l',
          'name': 'I\'m a task with links!',
          'description': '',
          'color': '#ff80ab',
          'items': ['jc0m3uxidpb1krerkvh3v2'],
          'ref': ['9vk9ywmx4szziub8qxqo', 'ez1lvoo3dwkwmhdrh9s77']
        } as FrozenNote,
        '7fv55sy73d7epp5kqnguul': {
          'id': '7fv55sy73d7epp5kqnguul',
          'name': '',
          'description': '',
          'color': '#80d8ff',
          'items': ['v52993i59eby59317v6ejc'],
          'ref': []
        } as FrozenNote,
        'v52993i59eby59317v6ejc': {
          'id': 'v52993i59eby59317v6ejc',
          'name': '',
          'description': '',
          'color': '#80d8ff',
          'items': [],
          'ref': []
        } as FrozenNote,
        '9ywa2zu4zgtbqz8v7sa2j': {
          'id': '9ywa2zu4zgtbqz8v7sa2j',
          'name': '',
          'description': '',
          'color': '#ffffff',
          'items': ['7khopamf94pri5sb56dtwr'],
          'ref': []
        } as FrozenNote,
        'ez1lvoo3dwkwmhdrh9s77': {
          'id': 'ez1lvoo3dwkwmhdrh9s77',
          'name': '🐟 Easy',
          'description': '',
          'color': '#ffd180',
          'items': ['nmhbxh86d9gpf3zgxcv0e'],
          'ref': ['7llyfbgu4eb9rae6kb074l']
        } as FrozenNote,
        '34606nw061xmm5vbsi9r6c': {
          'id': '34606nw061xmm5vbsi9r6c',
          'name': '',
          'description': '',
          'color': '#ffffff',
          'items': [],
          'ref': []
        } as FrozenNote,
        'nmhbxh86d9gpf3zgxcv0e': {
          'id': 'nmhbxh86d9gpf3zgxcv0e',
          'name': '',
          'description': '',
          'color': '#ffffff',
          'items': [],
          'ref': []
        } as FrozenNote,
        '7khopamf94pri5sb56dtwr': {
          'id': '7khopamf94pri5sb56dtwr',
          'name': '',
          'description': '',
          'color': '#ffffff',
          'items': [],
          'ref': []
        } as FrozenNote,
        'jc0m3uxidpb1krerkvh3v2': {
          'id': 'jc0m3uxidpb1krerkvh3v2',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': ['uw92fsodzs8scqpxraedd'],
          'ref': []
        } as FrozenNote,
        'uw92fsodzs8scqpxraedd': {
          'id': 'uw92fsodzs8scqpxraedd',
          'name': '',
          'description': '',
          'color': '#ff80ab',
          'items': [],
          'ref': []
        } as FrozenNote,
        'ialkx35n6mo697qcqaulvl': {
          'id': 'ialkx35n6mo697qcqaulvl',
          'name': '',
          'description': '',
          'color': '#ffd180',
          'items': ['jb9zpt8uecbm04vlm2hg2h'],
          'ref': []
        } as FrozenNote,
        'jb9zpt8uecbm04vlm2hg2h': {
          'id': 'jb9zpt8uecbm04vlm2hg2h',
          'name': '',
          'description': '',
          'color': '#ffd180',
          'items': [],
          'ref': []
        } as FrozenNote
      }
    )

    this.view.eye = this.view.show = this.top = notes.get('9ecal36r08qsegt2q7ruar')

    const localify = this.rawNewId()

    for (const n of notes.values()) {
      n.id = n.id + localify
    }

    this.notes = new Map<string, Note>()

    for (const n of notes.values()) {
      this.notes.set(n.id, n)
    }

    this.saveAll()
    this.save()
  }

  private migrateRoot(root: Note) {
    this.notes = new Map<string, Note>()

    this.top = root
    this.migrateRootAdd(root)

    this.saveAll()
    localStorage.setItem('version', '1')
  }

  private migrateRootAdd(note: Note) {
    this.notes.set(note.id, note)

    for (const subItem of note.items) {
      subItem.parent = note
      this.migrateRootAdd(subItem)
    }
  }
}
