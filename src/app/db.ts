let _db: IDBDatabase
const request = indexedDB.open('db', 1)

request.onsuccess = () => {
  _db = request.result
}
request.onerror = (event) => {
  console.error('indexedDB request error', event)
}

request.onupgradeneeded = (event) => {
  _db = null
  const store = (event.target as IDBOpenDBRequest).result.createObjectStore('s', {
    keyPath: 'k'
  })

  store.transaction.oncomplete = (e) => {
    _db = (e.target as IDBTransaction).db
  }
}

const delay = ms => new Promise(res => setTimeout(res, ms))

const ready = async () => {
  while (!_db) {
    await delay(50)
  }
}

export const db = {
  get: async (key: string): Promise<string | null> => {
    await ready()
    return new Promise<string>((resolve, reject) => {
      _db.transaction('s').objectStore('s').get(key).onsuccess = (event) => {
        resolve(((event.target as IDBRequest).result && (event.target as IDBRequest).result['v'] as string) || null)
      }
    })
  },
  set: async (key: string, value: string): Promise<void> => {
    await ready()
    return new Promise<void>((resolve, reject) => {
      const txn = _db.transaction('s', 'readwrite')
      txn.oncomplete = () => {
        resolve()
      }
      txn.objectStore('s').put({
        'k': key,
        'v': value,
      })
      txn.commit()
    })
  },
  delete: async (key: string): Promise<void> => {
    await ready()
    return new Promise<void>((resolve, reject) => {
      _db.transaction('s', 'readwrite').objectStore('s').delete(key).onsuccess = () => {
        resolve()
      }
    })
  },
  list: async (): Promise<Array<string>> => {
    await ready()
    return new Promise<Array<string>>((resolve, reject) => {
      _db.transaction('s').objectStore('s').getAllKeys().onsuccess = (event) => {
        const result = ((event.target as IDBRequest<Array<IDBValidKey>>).result) || null
        resolve(result.map(it => it as string))
      }
    })
  },
  getAll: async (): Promise<Array<any>> => {
    await ready()
    return new Promise<Array<string>>((resolve, reject) => {
      _db.transaction('s').objectStore('s').getAll().onsuccess = (event) => {
        const result = ((event.target as IDBRequest).result) || null
        resolve(result)
      }
    })
  },
  clear: async (): Promise<void> => {
    await ready()
    return new Promise<void>((resolve, reject) => {
      _db.transaction('s', 'readwrite').objectStore('s').clear().onsuccess = () => {
        resolve()
      }
    })
  },
}
