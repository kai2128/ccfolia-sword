// Firestore writer · 走 ccfolia 自己的 Firebase SDK
//
// 从 webpack 运行时挖出 ccfolia 用的 `db` 实例 + `setDoc`/`doc`/
// `serverTimestamp`,直接走 SDK 写:
//   1. SDK 同步更新本地 cache,onSnapshot 立刻 fire (hasPendingWrites=true)
//   2. SDK 把 mutation 塞进已存在的 Write/channel,不会让 RID 错位
//   3. 失败时 SDK 自己重试 / 回滚,我们不用管
// api 没 ready 就抛 — UI 已经 gate 过 `useFirestoreReady`,正常不会走到这。

import type { BuffPayload } from '@/types/buff'
import type { CcfoliaCharacter, CcfoliaParam, CcfoliaStatus } from '@/types/ccfolia'
import { createLogger } from '@/infra/log'
import { buffLabel, isBuffLabel } from '@/types/buff'
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

// 写 params 数组的公共入口:Redux 乐观 + SDK 写,失败回滚。
async function commitParams(char: CcfoliaCharacter, newParams: CcfoliaParam[]): Promise<void> {
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

// 生成 uuid。Tampermonkey sandbox 里 crypto.randomUUID 可能走 top-level window,
// 两边都尝试一下。
function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID)
    return c.randomUUID()
  // fallback — 质量不高但够用
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function attachBuff(char: CcfoliaCharacter, payload: Omit<BuffPayload, 'v' | 'id' | 'attachedAt'> & Partial<Pick<BuffPayload, 'id'>>): Promise<BuffPayload> {
  const id = payload.id ?? uuid()
  const buff: BuffPayload = {
    ...payload,
    v: 1,
    id,
    attachedAt: { round: 0, timestamp: Date.now() },
  }
  const label = buffLabel(id)
  const newParams: CcfoliaParam[] = [
    ...char.params.filter(p => p.label !== label),
    { label, value: JSON.stringify(buff) },
  ]
  await commitParams(char, newParams)
  return buff
}

export async function detachBuff(char: CcfoliaCharacter, buffId: string): Promise<void> {
  const label = buffLabel(buffId)
  const newParams = char.params.filter(p => p.label !== label)
  if (newParams.length === char.params.length)
    return // 没找到,直接返 — 幂等
  await commitParams(char, newParams)
}

export function listBuffs(char: CcfoliaCharacter): BuffPayload[] {
  const out: BuffPayload[] = []
  for (const p of char.params) {
    if (!isBuffLabel(p.label))
      continue
    try {
      const parsed = JSON.parse(p.value) as BuffPayload
      if (parsed && typeof parsed === 'object' && parsed.v === 1)
        out.push(parsed)
    }
    catch {
      // 坏数据跳过,不抛
      log.warn('bad buff payload', { label: p.label })
    }
  }
  return out
}
