// Firestore writer · 走 ccfolia 自己的 Firebase SDK
//
// 从 webpack 运行时挖出 ccfolia 用的 `db` 实例 + `setDoc`/`doc`/
// `serverTimestamp`,直接走 SDK 写:
//   1. SDK 同步更新本地 cache,onSnapshot 立刻 fire (hasPendingWrites=true)
//   2. SDK 把 mutation 塞进已存在的 Write/channel,不会让 RID 错位
//   3. 失败时 SDK 自己重试 / 回滚,我们不用管
// api 没 ready 就抛 — UI 已经 gate 过 `useFirestoreReady`,正常不会走到这。

import type { CcfoliaCharacter, CcfoliaParam, CcfoliaStatus } from '@/types/ccfolia'
import { createLogger } from '@/infra/log'
import { optimisticUpdateCharacter } from './redux-store'
import { getFirestoreApi } from './webpack-hook'

const log = createLogger('writer')

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
  if (!api) {
    log.error('patchStatus called before SDK ready')
    throw new Error('Firebase SDK 还没挂钩完成')
  }
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', charId)
  try {
    await setDoc(
      ref as never,
      { status: newStatus, updatedAt: serverTimestamp() },
      { merge: true },
    )
    log.debug('setDoc ok', { roomId, charId })
  }
  catch (e) {
    log.error('setDoc failed', { roomId, charId, error: e })
    throw e
  }
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

// ======== params 写入(buff / part / meta 共用)========
// 命名空间约定见 doc 10 §Label 命名空间约定。sword 只读写 `cs_*` 前缀。

export interface PatchParamsArgs {
  roomId: string
  charId: string
  newParams: CcfoliaParam[]
}

export async function patchParams({ roomId, charId, newParams }: PatchParamsArgs): Promise<void> {
  const api = getFirestoreApi()
  if (!api) {
    log.error('patchParams called before SDK ready')
    throw new Error('Firebase SDK 还没挂钩完成')
  }
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', charId)
  try {
    await setDoc(
      ref as never,
      { params: newParams, updatedAt: serverTimestamp() },
      { merge: true },
    )
    log.debug('patchParams ok', { roomId, charId, count: newParams.length })
  }
  catch (e) {
    log.error('patchParams failed', { roomId, charId, error: e })
    throw e
  }
}

// ======== writeBatch 一次性多角色写入 ========
// 走 firestore writeBatch:N 个角色合并成 1 个 RPC,把 ack-by-ack 串行降级成一次 round-trip。
//
// 单一 writeBatch 上限 500 op,这里按 chunkSize 切分,多 chunk 用 Promise.all 并行 commit。
// 因为 commitWriteBatch 是「全成功或全失败」的,任一 chunk 失败抛错,调用方负责回退/告警。
// onProgress(committedCharCount, total) 在每个 chunk 完成后喂一次。
//
// 如果 webpack-hook 没抓到 writeBatch(老 ccfolia / 指纹失配),抛 'writeBatch 不可用',
// 调用方应当 try-catch 后回退到 Promise.all(setDoc) 路径。

export type DocPatch = Record<string, unknown>

export interface CharPatch {
  charId: string
  patch: DocPatch
}

// Firestore writeBatch 硬上限 500 op,但单个 RPC 还有 4 MiB body 限制。
// status 数组每条角色 ~5-15 KB,300 条就能撞 4 MiB(实测 302 条单 chunk 收到 400 bad request)。
// 收到 50 比较稳:302 → 7 个 chunk 并行 commit,每个 chunk 1 个 RPC,
// 总时间 ~ max(单 chunk RTT) 接近一次 round-trip。
const WRITE_BATCH_CHUNK = 50

export async function commitWriteBatch(
  roomId: string,
  updates: CharPatch[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = updates.length
  if (total === 0) {
    onProgress?.(0, 0)
    return
  }

  const api = getFirestoreApi()
  if (!api?.firestore.writeBatch)
    throw new Error('writeBatch 不可用 — 走回退路径')

  const { db, firestore: { doc, serverTimestamp, writeBatch } } = api
  onProgress?.(0, total)
  let done = 0

  // chunk → 多个 batch 并行;每个 batch 内部 1 RPC
  const chunks: CharPatch[][] = []
  for (let i = 0; i < total; i += WRITE_BATCH_CHUNK)
    chunks.push(updates.slice(i, i + WRITE_BATCH_CHUNK))

  await Promise.all(chunks.map(async (chunk) => {
    const batch = (writeBatch as (db: unknown) => {
      set: (ref: unknown, data: unknown, opts?: unknown) => unknown
      commit: () => Promise<void>
    })(db)

    for (const { charId, patch } of chunk) {
      const ref = doc(db as never, 'rooms', roomId, 'characters', charId)
      batch.set(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true })
    }
    await batch.commit()
    done += chunk.length
    onProgress?.(done, total)
  }))

  log.debug('writeBatch committed', { roomId, total, chunks: chunks.length })
}

// 写 params 数组的公共入口:Redux 乐观 + SDK 写,失败回滚。
export async function commitParams(char: CcfoliaCharacter, newParams: CcfoliaParam[]): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId — 请在 ccfolia 房间内打开')

  const optimistic = { ...char, params: newParams }
  const dispatched = optimisticUpdateCharacter(optimistic as unknown as { _id: string } & Record<string, unknown>)

  try {
    await patchParams({ roomId, charId: char._id, newParams })
  }
  catch (e) {
    if (dispatched)
      optimisticUpdateCharacter(char as unknown as { _id: string } & Record<string, unknown>)
    throw e
  }
}
