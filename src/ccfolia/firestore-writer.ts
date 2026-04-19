// Firestore writer · 走 ccfolia 自己的 Firebase SDK
//
// 从 webpack 运行时挖出 ccfolia 用的 `db` 实例 + `setDoc`/`doc`/
// `serverTimestamp`,直接走 SDK 写:
//   1. SDK 同步更新本地 cache,onSnapshot 立刻 fire (hasPendingWrites=true)
//   2. SDK 把 mutation 塞进已存在的 Write/channel,不会让 RID 错位
//   3. 失败时 SDK 自己重试 / 回滚,我们不用管
// api 没 ready 就抛 — UI 已经 gate 过 `useFirestoreReady`,正常不会走到这。

import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { optimisticUpdateCharacter } from './redux-store'
import { getFirestoreApi } from './webpack-hook'

// 从 /rooms/<id>/... 这样的路径取 roomId。character 对象里的 roomId 字段
// 对某些匿名用户 / 旧角色会是 null,不可靠。
export function getCurrentRoomId(): string | null {
  const m = location.pathname.match(/\/rooms\/([^/?#]+)/)
  return m ? m[1] : null
}

export interface PatchStatusArgs {
  roomId: string
  charId: string
  newStatus: CcfoliaStatus[]
}

export async function patchStatus({ roomId, charId, newStatus }: PatchStatusArgs): Promise<void> {
  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 还没挂钩完成')
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', charId)
  await setDoc(
    ref as never,
    { status: newStatus, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function adjustStatusValue(
  char: CcfoliaCharacter,
  statusIndex: number,
  delta: number,
): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId — 请在 ccfolia 房间内打开')
  const next = char.status.map(s => ({ ...s }))
  const slot = next[statusIndex]
  if (!slot)
    throw new Error(`status[${statusIndex}] not found`)
  slot.value = Math.max(0, slot.value + delta)

  // 乐观更新 Redux,UI 瞬间反映。SDK setDoc 完成后 onSnapshot 会再刷一次同值,幂等。
  // 写入失败下面会 rollback。
  const optimistic = { ...char, status: next }
  const dispatched = optimisticUpdateCharacter(optimistic as unknown as { _id: string } & Record<string, unknown>)

  try {
    await patchStatus({ roomId, charId: char._id, newStatus: next })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
