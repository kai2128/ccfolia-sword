import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { cellToPx, parseCellRef } from '@/core/range'

// 把 character piece 移到指定格位:走 setDoc(rooms/{roomId}/characters/{charId}, {x,y}),
// 与 commitParams / patchStatus 同款 doc 路径。Redux 乐观先动,失败回滚。
export async function setCharacterCell(
  characterId: string,
  cellRef: string,
  grid: GridConfig,
): Promise<void> {
  const cell = parseCellRef(cellRef, grid)
  if (!cell)
    throw new Error(`无效格位:${cellRef}`)

  const { x, y } = cellToPx(cell, grid)

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
    ? optimisticUpdateCharacter({ ...char, x, y } as unknown as { _id: string } & Record<string, unknown>)
    : false

  try {
    await setDoc(ref as never, { x, y, updatedAt: serverTimestamp() }, { merge: true })
  }
  catch (e) {
    if (dispatched && char)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
