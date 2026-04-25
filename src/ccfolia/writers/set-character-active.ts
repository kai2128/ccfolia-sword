import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'

// active=false:ccfolia 把 character 视为"非激活",sword 的 useRoomCharactersStore 直接过滤掉。
// 数据没毁,GM 在 ccfolia 自己的 character 管理 UI 重新激活即可。
// 走 setDoc + merge,不调 deleteDoc(避免动 webpack-hook 指纹)。
export async function setCharacterActive(characterId: string, active: boolean): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  await setDoc(ref as never, { active, updatedAt: serverTimestamp() }, { merge: true })
}
