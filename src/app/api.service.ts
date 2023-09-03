// tslint:disable:max-line-length

import {Injectable} from '@angular/core'
import {Router} from '@angular/router'
import {recentsLength, UiService} from './ui.service'
import {Subject} from 'rxjs'
import {Config} from 'app/config.service'
import Util from './util'
import {db} from './db'

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
  /**
   * Note rev from server
   */
  rev: string
  /**
   * The device that made this revision
   */
  revSrc: string
  parent?: Note
  name: string
  date?: string
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

  /**
   * List of locally modified props that haven't synced
   *
   * null = Entire note is not synced
   * [] = Entire note is synced
   * [prop, prop, ...] = Specific props are not synced
   */
  _local?: string[]

  /**
   * false if this note is not shared
   */
  _sync?: boolean

  /**
   * false if this note is not editable (view only)
   */
  _edit?: boolean
}

export class FrozenNote {
  id: string
  rev: string
  revSrc: string
  parent?: FrozenNote
  name: string
  date?: string
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
  _sync?: boolean
  _edit?: boolean
}

export class NoteChanges {
  public note: Note

  /**
   * The changed property, or null if the entire note is to be considered changed.
   */
  public property: string | null

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
  private readonly notes: Map<string, Note> = new Map<string, Note>()
  private readonly invitations: Map<string, Invitation> = new Map<string, Invitation>

  private readonly view: ViewConfig = {
    eye: null,
    show: null,
    parents: []
  }

  // Observer local changes
  public onNoteChangedObservable: Subject<NoteChanges> = new Subject<NoteChanges>()

  // Observe all note updates, including changes from the remote
  public onNoteUpdatedObservable: Subject<NoteChanges> = new Subject<NoteChanges>()

  // Observe current view changes
  public onViewChangedObservable: Subject<ViewConfig> = new Subject<ViewConfig>()

  constructor(private ui: UiService, private config: Config, private router: Router) {
    this.load()
  }

  /* Persistence */

  save() {
    if (this.top) {
      db.set('top', this.top.id)
    }
  }

  async load() {
    const version = +(await db.get('version') || 0)

    if (version < 3) {
      db.set('version', '3')
    }

    const localNotes = new Map<string, FrozenNote | Note>()

    for (const n of await db.getAll()) {
      if (n.k.substring(0, 5) === 'note:') {
        const n2 = JSON.parse(n.v)
        localNotes.set(n2.id, n2)
      } else if (n.k.substring(0, 11) === 'invitation:') {
        this.updateInvitation(JSON.parse(n.v))
      }
    }

    if (localNotes.size) {
      for (const n of localNotes.values()) {
        this.unfreezeNote(n as FrozenNote, localNotes)
      }

      localNotes.forEach(n => {
        this.notes.set(n.id, n as Note)
      })

      this.resetView()
    } else {
      this.intro()
    }

    this.observeStorage()
  }

  private observeStorage() {
    // TODO BROKEN! SWITCHED TO INDEXDB - Use BroadcastChannel
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
    note.date = referenceNote.date
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
    note._sync = referenceNote._sync
    note._edit = referenceNote._edit

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
    db.set('note:' + note.id, JSON.stringify(this.freezeNote(note)))
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
  freezeNote(a: Partial<Note>, forServer = false): Partial<FrozenNote> {
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

    return this.strip({
      id: a.id,
      rev: a.rev,
      name: a.name,
      date: a.date,
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
      ...(!forServer ? { _local: a._local, _sync: a._sync, _edit: a._edit } : {})
    } as Partial<FrozenNote>)
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
          if (this.config.dev) {
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
          if (this.config.dev) {
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
   * Unfreeze a property from the server
   *
   * Returns @value The prop's unfrozen value
   * Returns @init A list of any notes that needed to be initialized
   */
  unfreezeProp(note: Note, prop: string, value: any): { value: any, init: string[] } {
    if (['invitations', 'ref', 'items'].indexOf(prop) !== -1) {
      if (!value) {
        return { value: [], init: [] }
      }

      const a = []

      if (prop === 'invitations') {
        for (const id of value) {
          a.push(this.invitation(id))
        }

        return { value: a, init: [] }
      } else {
        const init: string[] = []
        for (const id of value) {
          let item = this.search(id)

          if (!item) {
            init.push(id)
            item = this.newBlankNote(true, id)
            this.saveNote(item)
          }

          a.push(item)

          if (prop === 'items') {
            item.parent = note
          }
        }

        return { value: a, init }
      }
    }

    return { value, init: [] }
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
    db.set('invitation:' + invitation.id, JSON.stringify(p))
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

  refreshInvitations(invitations: Invitation[]): Invitation[] {
    const all = invitations.map(it => it.id)
    const existing = [...this.invitations.keys()]
    for (const id of existing) {
      if (all.indexOf(id) === -1) {
        this.invitations.delete(id)
        db.delete('invitation:' + id)
        this.removeRecentInvitation(id)
      }
    }
    return invitations.map(p => this.updateInvitation(p))
  }

  /* View */

  up() {
    if (this.view.eye === this.view.show) {
      const eye = this.search(this.view.show.id)

      if (!eye || !this.parents(eye).length) {
        this.ui.dialog({
          message: 'Create new note containing this one?',
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

  async resetView() {
    const top = await db.get('top')

    if (top) {
      this.top = this.notes.get(top)
    } else {
      for (const note of this.notes.values()) {
        this.top = note
        break
      }
    }

    const viewId = await db.get('view')
    const showId = await db.get('view-show') || viewId

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
    if (this.router.url === '/' || this.router.url.startsWith('/n/')) {
      this.router.navigate(['n', this.view.show.id])
    }
    db.set('view', this.view.eye.id)
    db.set('view-show', this.view.show.id)

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
    return this.top?.items || []
  }

  search(id: string): Note {
    return this.notes.get(id)
  }

  parents(note: Note) {
    const list = [] as Array<Note>

    if (!note) {
      return list
    }

    while (note.parent && !list.includes(note.parent)) {
      list.unshift(note.parent)
      note = note.parent
    }

    return list
  }

  hasInvitation(note: Note, invitation: Invitation) {
    for (const n of this.parents(note)) {
      if (n.invitations?.find(i => i.id === invitation.id)) {
        return true
      }
    }

    return false
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
    const changes = new NoteChanges(note, prop)
    this.onNoteChangedObservable.next(changes)
    this.onNoteUpdatedObservable.next(changes)
  }

  /**
   * Set a note prop as synced.
   */
  setSynced(id: string, prop: string) {
    const note = this.search(id)

    if (!note) {
      if (this.config.dev) {
        console.log('Cannot set note as synced: ' + id)
      }
      return
    }

    this.setPropSynced(note, prop)
    this.saveNote(note)
    this.onNoteUpdatedObservable.next(new NoteChanges(note, prop))
  }

  /**
   * Set all props synced
   */
  setAllPropsSynced(note: Note) {
    note._local = []
    delete note._sync
    this.saveNote(note)
  }

  /**
   * Returns true of all props are synced
   */
  allPropsAreSynced(note: Note): boolean {
    return note._local?.length === 0
  }

  setNoteRev(id: string, rev: string, oldRev: string | null): boolean {
    const note = this.search(id)

    if (note && (note.rev || null) === oldRev) {
      note.rev = rev
      delete note._sync
      this.setAllPropsSynced(note)
      return true
    }

    return false
  }

  /**
   * setPropSynced
   */
  setPropSynced(note: Note, prop: string) {
    delete note._sync

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
      name: 'New top note',
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
    const list = this.search(listId)
    const toList = this.search(toListId)

    if (listId === toListId) {
      this.ui.dialog({
        message: 'Note cannot be moved into itself.'
      })
      return
    }

    if (!list || !toList) {
      this.ui.dialog({
        message: 'Note could not be found.'
      })
      return
    }

    if (list._edit === false || list._sync === false || toList._edit === false || toList._sync === false) {
      this.ui.dialog({
        message: 'This note is not shared with you at the moment and cannot be moved.'
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

      // Don't sync twice if moving within the same list
      if (listParent !== toList) {
      this.modified(listParent, 'items')
      }
    }

    if (toList === listParent && oldPos < position) {
      position--
    }

    if (position < 0) {
      position = this.findLastPosition(toList)
    }

    if (position >= 0 && position < toList.items.length) {
      toList.items.splice(position, 0, list)
    } else {
      toList.items.push(list)
    }

    this.modified(toList, 'items')

    list.parent = toList
  }

  findLastPosition(note: Note): number {
    // @ts-ignore findLastIndex
    return note.items.findLastIndex((item: Note) => !item.name)
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
      // todo
      // note.steward = list.steward
      // this.modified(note, 'steward')

      if (position === null) {
        list.items.push(note)
      } else {
        list.items.splice(position, 0, note)
      }

      this.modified(list, 'items')
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
      color: '#ffffff',
      items: [],
      created: new Date().toISOString()
    } as Note

    if (this.notes) {
      this.notes.set(note.id, note)
    }

    if (fromServer) {
      // Set all props synced
      note._local = []
    }

    this.saveNote(note)

    return note
  }

  /* Relationships */

  addRef(list: Note, toList: Note) {
    if (list._sync === false || toList._sync === false) {
      this.ui.dialog({
        message: 'This note is not syncing with you at the moment and cannot be linked.'
      })
      return
    }

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
    if (list._sync === false || newRef._sync === false) {
      this.ui.dialog({
        message: 'This note is not syncing with you at the moment and cannot be linked.'
      })
      return
    }

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

  async getRecent(which: string): Promise<Note[]> {
    const recent = await db.get('recent::' + which)

    if (!recent) {
      return []
    }

    return recent.split(',').map(noteId => this.search(noteId)).filter(note => !!note)
  }

  async addRecent(which: string, noteId: string) {
    const recents = (await db.get('recent::' + which) || '').split(',').filter(n => n && n !== noteId)
    recents.unshift(noteId)
    if (recents.length > recentsLength) {
      recents.length = recentsLength
    }
    db.set('recent::' + which, recents.join(','))
  }

  async getRecentInvitations(): Promise<Invitation[]> {
    const recent = await db.get('recent-invitations')

    if (!recent) {
      return []
    }

    return recent.split(',').map(x => this.invitation(x)).filter(x => !!x)
  }

  async addRecentInvitation(invitation: Invitation) {
    const recents = (await db.get('recent-invitations') || '').split(',')
      .filter(x => x && x !== invitation.id)
    recents.unshift(invitation.id)
    if (recents.length > recentsLength) {
      recents.length = recentsLength
    }
    db.set('recent-invitations', recents.join(','))
  }

  async removeRecentInvitation(id: string) {
    const recents = (await db.get('recent-invitations') || '').split(',')
      .filter(x => x && x !== id)
    db.set('recent-invitations', recents.join(','))
  }

  /* Util */

  isEmptyNote(note: Note) {
    return Util.isEmptyStr(note.name)
      && (!note.items?.length || note.items.map(n => this.isEmptyNote(n)).indexOf(false) === -1)
      && Util.isEmptyStr(note.description)
      && note.checked !== true
      && !note.ref?.length
      && !note.estimate
  }

  newId() {
    let id

    do {
      id = this.rawNewId()
    } while (this.notes?.has(id))

    return id
  }

  /**
   * Useful to prevent undefined values from overwriting existing values when using Object.assign
   */
  strip(note: Partial<FrozenNote>): Partial<FrozenNote> {
    const n = {} as Partial<FrozenNote>
    Object.entries(note).forEach(v => {
      if (v[1] !== undefined) {
        n[v[0]] = v[1]
      }
    })
    return n
  }

  rawNewId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  invitationColor(id: string) {
    if (!id) { return '#404040' }
    return `hsl(${id.split('').map(it => it.charCodeAt(0)).reduce((a, b, i) => a * (i + 99) + b * (i + 99)) % 360}, 66%, 33%)`
  }

  private intro() {
    const top = this.newBlankNote()
    top.name = 'New note'
    this.saveNote(top)
    this.saveAll()
    this.save()
    this.view.eye = this.view.show = this.top = top
  }
}
