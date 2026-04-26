import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { cellToPx, pxToCell } from '@/core/range'

// 按格做相对位移。当前在板外直接抛错(UI 把方向键禁掉,所以正常路径不会走到)。
// 越界自动 clamp 到板内边缘,避免一不小心一脚迈出板外。
export async function moveCharacterByCells(
  characterId: string,
  dx: number,
  dy: number,
  grid: GridConfig,
): Promise<void> {
  const char = useRoomCharactersStore().byId(characterId)
  if (!char)
    throw new Error(`未找到角色:${characterId}`)

  const cur = pxToCell({ x: char.x as number, y: char.y as number }, grid)
  if (!cur)
    throw new Error('角色在板外,无法按格相对移动')

  const nextCol = Math.max(0, Math.min(grid.cols - 1, cur.col + dx))
  const nextRow = Math.max(0, Math.min(grid.rows - 1, cur.row + dy))
  if (nextCol === cur.col && nextRow === cur.row)
    return

  const { x, y } = cellToPx({ col: nextCol, row: nextRow }, grid)

  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  const dispatched = optimisticUpdateCharacter(
    { ...char, x, y } as unknown as { _id: string } & Record<string, unknown>,
  )

  try {
    await setDoc(ref as never, { x, y, updatedAt: serverTimestamp() }, { merge: true })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
