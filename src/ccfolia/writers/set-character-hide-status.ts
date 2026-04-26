import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'

// hideStatus=true:ccfolia 在「盤上のキャラクター一覧に表示しない」隐藏该角色。
// 走 setDoc + merge,与 setCharacterActive 同款,不动指纹敏感 API。
export async function setCharacterHideStatus(characterId: string, hideStatus: boolean): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  await setDoc(ref as never, { hideStatus, updatedAt: serverTimestamp() }, { merge: true })
}
