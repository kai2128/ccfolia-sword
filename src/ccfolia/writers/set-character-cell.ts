import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { cellToPx, parseCellRef } from '@/core/range'

// 把 character piece 移到指定格位:语义是 piece 的 box 中心对齐 cell 中心。
// ccfolia 把 character.x/y 当作 .movable 的左上角(像素),所以要从 cell 中心反推出 box 左上角。
// 走 setDoc(rooms/{roomId}/characters/{charId}, {x,y}),与 commitParams / patchStatus 同款 doc 路径。Redux 乐观先动,失败回滚。
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

  // cellToPx 返回左上角(grid.pieceAnchor='top-left'),加 cellSizePx/2 得到 cell 中心,
  // 再减去 piece 自身宽/高的一半,得到 .movable 左上角。
  const cellTopLeft = cellToPx(cell, grid)
  const widthCells = typeof char.width === 'number' && Number.isFinite(char.width) ? char.width : 1
  const heightCells = typeof char.height === 'number' && Number.isFinite(char.height) ? char.height : 1
  const widthPx = widthCells * grid.cellSizePx
  const heightPx = heightCells * grid.cellSizePx
  const x = cellTopLeft.x + grid.cellSizePx / 2 - widthPx / 2
  const y = cellTopLeft.y + grid.cellSizePx / 2 - heightPx / 2

  const dispatched = optimisticUpdateCharacter({ ...char, x, y } as unknown as { _id: string } & Record<string, unknown>)

  try {
    await setDoc(ref as never, { x, y, updatedAt: serverTimestamp() }, { merge: true })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
