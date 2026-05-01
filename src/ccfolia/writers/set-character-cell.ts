import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { num } from '@/ccfolia/pieces-store'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { boxTopLeftForCellBottomCenter, cellToPx, parseCellRef } from '@/core/range'

type CharLike = { _id: string } & Record<string, unknown>

// 把 character piece 移到指定格位:typed cell 的底边中点 = piece box 底边中点(脚下)。
// 走 setDoc(rooms/{roomId}/characters/{charId}, {x,y}),Redux 乐观先动,失败回滚。
export async function setCharacterCell(
  characterId: string,
  cellRef: string,
  grid: GridConfig,
): Promise<void> {
  const cell = parseCellRef(cellRef, grid)
  if (!cell)
    throw new Error(`无效格位:${cellRef}`)

  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  const char = useRoomCharactersStore().byId(characterId)
  if (!char)
    throw new Error(`角色不存在:${characterId}`)

  const size = { widthCells: num(char.width, 1), heightCells: num(char.height, 1) }
  const targetTopLeft = boxTopLeftForCellBottomCenter(cellToPx(cell, grid), size, grid)
  const { x, y } = targetTopLeft

  const charLike = char as unknown as CharLike
  const dispatched = optimisticUpdateCharacter({ ...charLike, x, y })

  try {
    await setDoc(ref as never, { x, y, updatedAt: serverTimestamp() }, { merge: true })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(charLike)
    throw e
  }
}
