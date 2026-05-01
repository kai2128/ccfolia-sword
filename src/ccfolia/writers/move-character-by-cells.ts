import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { num } from '@/ccfolia/pieces-store'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { boxTopLeftForCellCenter, cellToPx, pieceBoxCenter, pxToCell } from '@/core/range'

type CharLike = { _id: string } & Record<string, unknown>

// 按格做相对位移。语义和 setCharacterCell 一致:piece box 中心对齐 cell 中心。
// 当前在板外直接抛错(UI 把方向键禁掉,所以正常路径不会走到)。越界自动 clamp 到板内边缘,避免一不小心一脚迈出板外。
export async function moveCharacterByCells(
  characterId: string,
  dx: number,
  dy: number,
  grid: GridConfig,
): Promise<void> {
  const char = useRoomCharactersStore().byId(characterId)
  if (!char)
    throw new Error(`未找到角色:${characterId}`)

  const size = { widthCells: num(char.width, 1), heightCells: num(char.height, 1) }
  const cur = pxToCell(pieceBoxCenter({ x: char.x as number, y: char.y as number, ...size }, grid), grid)
  if (!cur)
    throw new Error('角色在板外,无法按格相对移动')

  const nextCol = Math.max(0, Math.min(grid.cols - 1, cur.col + dx))
  const nextRow = Math.max(0, Math.min(grid.rows - 1, cur.row + dy))
  if (nextCol === cur.col && nextRow === cur.row)
    return

  const { x, y } = boxTopLeftForCellCenter(cellToPx({ col: nextCol, row: nextRow }, grid), size, grid)

  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

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
