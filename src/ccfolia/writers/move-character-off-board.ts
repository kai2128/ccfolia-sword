import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'

// 主板外的"收纳位"。固定大负值,避开任何合法格;不依赖 grid 配置。
// pxToCell 必返 null,group.ts 自动归到 off-canvas 组,无需 hidden 字段。
const OFF_BOARD_X = -10000
const OFF_BOARD_Y = -10000

export async function moveCharacterOffBoard(characterId: string): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  const char = useRoomCharactersStore().byId(characterId)
  const dispatched = char
    ? optimisticUpdateCharacter({ ...char, x: OFF_BOARD_X, y: OFF_BOARD_Y } as unknown as { _id: string } & Record<string, unknown>)
    : false

  try {
    await setDoc(
      ref as never,
      { x: OFF_BOARD_X, y: OFF_BOARD_Y, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }
  catch (e) {
    if (dispatched && char)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
