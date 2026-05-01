import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { cellToPx, pxToCell } from '@/core/range'

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

  // char.x/y 是 .movable 左上角;先算 box 中心,再用 box 中心定位"角色当前在哪个格"。
  const widthCells = typeof char.width === 'number' && Number.isFinite(char.width) ? char.width : 1
  const heightCells = typeof char.height === 'number' && Number.isFinite(char.height) ? char.height : 1
  const widthPx = widthCells * grid.cellSizePx
  const heightPx = heightCells * grid.cellSizePx
  const boxCenter = {
    x: (char.x as number) + widthPx / 2,
    y: (char.y as number) + heightPx / 2,
  }
  const cur = pxToCell(boxCenter, grid)
  if (!cur)
    throw new Error('角色在板外,无法按格相对移动')

  const nextCol = Math.max(0, Math.min(grid.cols - 1, cur.col + dx))
  const nextRow = Math.max(0, Math.min(grid.rows - 1, cur.row + dy))
  if (nextCol === cur.col && nextRow === cur.row)
    return

  // box 中心对齐目标 cell 中心,反推 .movable 左上角。
  const cellTopLeft = cellToPx({ col: nextCol, row: nextRow }, grid)
  const x = cellTopLeft.x + grid.cellSizePx / 2 - widthPx / 2
  const y = cellTopLeft.y + grid.cellSizePx / 2 - heightPx / 2

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
