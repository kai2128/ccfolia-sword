import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'

// 写单个角色的 angle 字段(0=正立, 90=倒地)。走 setDoc+merge,与 set-character-hide-status.ts 同款。
export async function setCharacterAngle(characterId: string, angle: number): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  await setDoc(ref as never, { angle, updatedAt: serverTimestamp() }, { merge: true })
}
