export interface CollaborativeJsonNode {
  sync(prop: string, node: Object, foreign: Object): Object

  set(prop: string, node: Object, foreign: Object)
}

export class Conflict {
  property: string
  local: any
  foreign: any

  constructor(
    property: string,
    local: any,
    foreign: any
  ) {
    this.property = property
    this.local = local
    this.foreign = foreign
  }
}

export class ConflictResolution {
  resolved: boolean
  conflict: Conflict

  constructor(
    resolved: boolean,
    conflict: Conflict
  ) {
    this.resolved = resolved
    this.conflict = conflict
  }
}

export interface ConflictResolver {
  resolve(conflict: Conflict): Promise<ConflictResolution>
}

export class CollaborativeJson {

  private syncProperty: string
  private propertyRules: Object

  /**
   * @param syncProperty The property used for syncing purposes
   */
  constructor(syncProperty: string) {
    this.syncProperty = syncProperty
    this.propertyRules = {}
  }

  /**
   * @param propertyName The property to sync
   * @param rule The rule used to sync this property
   */
  public addRule(propertyName: string, rule: CollaborativeJsonNode) {
    this.propertyRules[propertyName] = rule
  }

  /**
   * @param node The node to sync.  Modified in place.
   * @param foreign The foreign node to sync with
   * @param resolver The conflict resolver to use
   * @returns true on success
   */
  public sync(node: Object, foreign: Object, resolver: ConflictResolver = null): Promise<boolean> {
    const conflicts: Array<Conflict> = []

    if (!(this.syncProperty in node)) {
      node[this.syncProperty] = {}
    }

    // Precondition: Foreign sanity
    if (!(this.syncProperty in foreign)) {
      this.reportError('foreign node is missing \'' + this.syncProperty + '\' property, skipping')
      return Promise.reject(false)
    }

    for (const key in foreign) {
      // Precondition: Rule exists
      if (!this.propertyRules[key]) {
        continue
      }

      // Precondition: Value changed
      if (node[key] === foreign[key]) {
        continue
      }

      // Precondition: foreign has sync property
      if (!foreign[this.syncProperty][key]) {
        this.reportError('foreign node does not have sync property: ' + key)

        if (!this.propertyRules[key].sync(key, node, foreign)) {
          this.reportError('local node auto-verify failed: ' + key)
          conflicts.push(new Conflict(key, node, foreign))
        }

        continue
      }

      // Precondition: never overwrite modified
      if (!node[this.syncProperty][key]) {
        this.reportError('local node has never been synchronized: ' + key)
        conflicts.push(new Conflict(key, node, foreign))
        continue
      }

      const nodePropTime = node[this.syncProperty][key].time
      const foreignPropTime = foreign[this.syncProperty][key].time

      // Precondition: Foreign time exists
      if (!foreignPropTime) {
        this.reportError('foreign node property has no sync time: ' + key)
        conflicts.push(new Conflict(key, node, foreign))
        continue
      }

      // Precondition: Ok to overwrite foreign
      if (node[this.syncProperty][key].synchronized) {
        if (nodePropTime === foreignPropTime) {
          this.reportError('local node is synchronized and equals foreign node time: ' + key)
          continue
        } else if (foreignPropTime > nodePropTime) {
          this.reportError('local node is synchronized and foreign time is greater: ' + key)
          this.propertyRules[key].set(key, node, foreign)
          continue
        }
      }

      // Precondition: Time compare
      if (nodePropTime > foreignPropTime) {
        this.reportError('local node property has greater time: ' + key + ' times: ' + nodePropTime + ' - ' + foreignPropTime)
        conflicts.push(new Conflict(key, node, foreign))

      } else if (!this.propertyRules[key].sync(key, node, foreign)) {
        this.reportError('local node auto-merge failed: ' + key)
        conflicts.push(new Conflict(key, node, foreign))
      } else {
        this.propertyRules[key].set(key, node, foreign)
        this.resolve(node, key)
      }
    }

    if (resolver && conflicts.length) {
      return new Promise<boolean>((resolve, reject) => {
        const next = () => resolver.resolve(conflicts.pop()).then((resolution: ConflictResolution) => {
          if (resolution.resolved) {
            this.resolve(node, resolution.conflict.property)
          }

          if (conflicts.length) {
            next()
          } else {
            resolve(true)
          }
        })

        next()
      })
    }

    return Promise.resolve(true)
  }

  public resolve(node: any, key: string) {
    if (!(this.syncProperty in node)) {
      node[this.syncProperty] = {}
    }

    if (!(key in node[this.syncProperty])) {
      node[this.syncProperty][key] = {}
    }

    node[this.syncProperty][key].time = new Date().getTime()
    node[this.syncProperty][key].synchronized = true
  }

  private reportError(err: string) {
    console.log(err)
  }
}

export class CollaborativeJsonAtom implements CollaborativeJsonNode {
  sync(key: string, node: Object, foreign: Object): boolean {
    if (node[key] === foreign[key]) {
      return true
    } else {
      return false
    }
  }

  set(key: string, node: Object, foreign: Object) {
    node[key] = foreign[key]
  }
}
