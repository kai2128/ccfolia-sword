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
import { getReduxStore, optimisticUpdateCharacter } from './redux-store'
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

export function readCharacterParams(characterId: string): CcfoliaParam[] {
  const store = getReduxStore()
  if (!store)
    return []
  const state = store.getState() as {
    entities?: { roomCharacters?: { entities?: Record<string, CcfoliaCharacter> } }
  }
  return state.entities?.roomCharacters?.entities?.[characterId]?.params ?? []
}

async function writeCharacterParamsRaw(characterId: string, params: CcfoliaParam[]): Promise<void> {
  const store = getReduxStore()
  const state = store?.getState() as {
    entities?: { roomCharacters?: { entities?: Record<string, CcfoliaCharacter> } }
  } | undefined
  const char = state?.entities?.roomCharacters?.entities?.[characterId]
  if (!char)
    throw new Error(`character ${characterId} not in roomCharacters`)
  await commitParams(char, params)
}

const paramsWriteQueues = new Map<string, Promise<void>>()

export async function withParamsLock<T>(
  characterId: string,
  mutator: (current: CcfoliaParam[]) => CcfoliaParam[] | { next: CcfoliaParam[], result: T },
): Promise<T | void> {
  const previous = paramsWriteQueues.get(characterId) ?? Promise.resolve()
  let releaseResult: T | undefined

  const currentRun = previous.then(async () => {
    const current = readCharacterParams(characterId)
    const output = mutator(current)
    const next = Array.isArray(output) ? output : output.next

    if (!Array.isArray(output))
      releaseResult = output.result

    if (next === current)
      return

    await writeCharacterParamsRaw(characterId, next)
  })

  const queueTail = currentRun.catch(() => undefined)
  paramsWriteQueues.set(characterId, queueTail)

  try {
    await currentRun
  }
  catch (error) {
    log.error('withParamsLock RMW failed', { characterId, error })
    throw error
  }
  finally {
    if (paramsWriteQueues.get(characterId) === queueTail)
      paramsWriteQueues.delete(characterId)
  }

  return releaseResult
}
