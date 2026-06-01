import type { GridConfig } from '@/core/range/types'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { getCurrentRoomId } from '@/ccfolia/firestore-writer'
import { num } from '@/ccfolia/pieces-store'
import { optimisticUpdateCharacter } from '@/ccfolia/redux-store'
import { getFirestoreApi } from '@/ccfolia/webpack-hook'
import { snapPieceToGrid } from '@/core/range'

type CharLike = { _id: string } & Record<string, unknown>

// 纯决策:给定角色"当前坐标",该不该吸附、吸到哪。null = 不写(坐标非法 / 脚下场外 / 已对齐)。
// 故意只吃坐标本身,逼调用方传入"新鲜"坐标 —— 之前的 bug 是 writer 回头读 sword 节流镜像
// store(byId),拿到拖动前的旧坐标,导致"不吸附"或"被拉回原位"。
export function computeSnapWrite(
  char: { x: unknown, y: unknown, width: unknown, height: unknown },
  grid: GridConfig,
): { x: number, y: number } | null {
  const cx = char.x
  const cy = char.y
  if (typeof cx !== 'number' || typeof cy !== 'number' || !Number.isFinite(cx) || !Number.isFinite(cy))
    return null
  const size = { widthCells: num(char.width, 1), heightCells: num(char.height, 1) }
  const target = snapPieceToGrid({ x: cx, y: cy, ...size }, grid)
  if (!target)
    return null
  if (target.x === cx && target.y === cy)
    return null
  return target
}

// 用调用方传入的"新鲜"角色实体(直接来自 Redux,不再回读节流镜像 store)算吸附目标并写回。
// 写回与 setCharacterCell 同范式:乐观先动 Redux,setDoc 失败回滚。
export async function snapCharacterToGrid(char: CcfoliaCharacter, grid: GridConfig): Promise<void> {
  const target = computeSnapWrite(
    { x: char.x, y: char.y, width: char.width, height: char.height },
    grid,
  )
  if (!target)
    return

  const roomId = getCurrentRoomId()
  if (!roomId)
    return
  const api = getFirestoreApi()
  if (!api)
    return
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', char._id)

  const charLike = char as unknown as CharLike
  const dispatched = optimisticUpdateCharacter({ ...charLike, x: target.x, y: target.y })
  try {
    await setDoc(ref as never, { x: target.x, y: target.y, updatedAt: serverTimestamp() }, { merge: true })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(charLike)
    throw e
  }
}
