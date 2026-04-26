import type { GridConfig } from '@/core/range/types'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'

// 主板外的"收纳位":贴在棋盘左侧外 2 格、与棋盘顶对齐。
// 既保证 pxToCell 返 null(group.ts 归 off-canvas),又让 piece 留在画布近板区域 ——
// GM 滚一下/缩一下就能看到、能直接在 ccfolia 拖回板上。
function offBoardCoords(grid: GridConfig): { x: number, y: number } {
  return {
    x: grid.originPx.x - grid.cellSizePx * 2,
    y: grid.originPx.y,
  }
}

export async function moveCharacterOffBoard(
  characterId: string,
  grid: GridConfig,
): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 未就绪')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', characterId)

  const { x, y } = offBoardCoords(grid)

  const char = useRoomCharactersStore().byId(characterId)
  const dispatched = char
    ? optimisticUpdateCharacter({ ...char, x, y } as unknown as { _id: string } & Record<string, unknown>)
    : false

  try {
    await setDoc(
      ref as never,
      { x, y, updatedAt: serverTimestamp() },
      { merge: true },
    )
  }
  catch (e) {
    if (dispatched && char)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
