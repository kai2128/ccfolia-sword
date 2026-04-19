// 从 Firebase Auth 的 IndexedDB 里抠出当前用户的 ID token。
// Firebase 9+ modular SDK 在浏览器里持久化到:
//   DB:    firebaseLocalStorageDb
//   Store: firebaseLocalStorage
//   Key:   firebase:authUser:<apiKey>:[DEFAULT]
//   Value: { ..., stsTokenManager: { accessToken, refreshToken, expirationTime } }
// SDK 每次刷新 token 都会写回这里,所以每次写操作前现读现用就是最新的。

interface StsTokenManager {
  accessToken?: string
  refreshToken?: string
  expirationTime?: number
}

interface AuthUserRecord {
  fbase_key?: string
  value?: {
    uid?: string
    stsTokenManager?: StsTokenManager
  }
}

export interface IdTokenInfo {
  token: string
  uid: string
  expirationTime: number
}

export async function getIdToken(): Promise<IdTokenInfo | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open('firebaseLocalStorageDb')
    }
    catch {
      resolve(null)
      return
    }
    req.onerror = () => resolve(null)
    req.onsuccess = () => {
      const db = req.result
      try {
        const tx = db.transaction('firebaseLocalStorage', 'readonly')
        const store = tx.objectStore('firebaseLocalStorage')
        const cursorReq = store.openCursor()
        let best: IdTokenInfo | null = null
        cursorReq.onerror = () => {
          db.close()
          resolve(null)
        }
        cursorReq.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cursor) {
            db.close()
            resolve(best)
            return
          }
          const v = cursor.value as AuthUserRecord
          if (typeof v?.fbase_key === 'string' && v.fbase_key.startsWith('firebase:authUser:')) {
            const mgr = v.value?.stsTokenManager
            const uid = v.value?.uid
            if (mgr?.accessToken && mgr.expirationTime && uid) {
              best = {
                token: mgr.accessToken,
                uid,
                expirationTime: mgr.expirationTime,
              }
            }
          }
          cursor.continue()
        }
      }
      catch {
        db.close()
        resolve(null)
      }
    }
  })
}
