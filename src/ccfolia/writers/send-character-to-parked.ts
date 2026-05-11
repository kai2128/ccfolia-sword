import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { readParkedLocation } from '@/core/parked-location'
import { restoreHpMpToMax } from './restore-hp-mp-to-max'

export interface SendToParkedOptions {
  restoreHpMp?: boolean
}

// 把角色精确送回先前保存的场外停放位 (px 级精度,不走 cell 网格)。
// 找不到 parked 条目 → throw,让上层在 UI 上把按钮 disable 掉以避免走到这里。
// opts.restoreHpMp = true 时,写完位置再回满 HP/MP(各部位独立)。
export async function sendCharacterToParked(
  characterId: string,
  opts: SendToParkedOptions = {},
): Promise<void> {
  const char = useRoomCharactersStore().byId(characterId)
  if (!char)
    throw new Error(`角色不存在:${characterId}`)

  const parked = readParkedLocation(char)
  if (!parked)
    throw new Error(`${char.name} 还没保存过场外停放位`)

  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  const { x, y } = parked
  const charLike = char as unknown as { _id: string } & Record<string, unknown>
  const dispatched = optimisticUpdateCharacter({ ...charLike, x, y })

  try {
    await setDoc(ref as never, { x, y, updatedAt: serverTimestamp() }, { merge: true })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(charLike)
    throw e
  }

  if (opts.restoreHpMp)
    await restoreHpMpToMax(char)
}
