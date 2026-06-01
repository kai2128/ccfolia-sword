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

// 把角色写到调用方算好的吸附落点。写回与 setCharacterCell 同范式:乐观先动 Redux,setDoc 失败回滚。
// target 由 computeSnapWrite 在控制器里算好并传入 —— 控制器负责 diff / 去重 / 防再入。
export async function writeSnappedPosition(
  char: CcfoliaCharacter,
  target: { x: number, y: number },
): Promise<void> {
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
