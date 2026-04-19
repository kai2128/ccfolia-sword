// Firestore writer · 走 ccfolia 自己的 Firebase SDK
//
// 以前走 REST :commit:一次性 POST 不占 ccfolia 的 Write/channel,不互相干扰,
// 但有 200-500ms 的 UI 回环延迟 —— 因为 ccfolia 本地 cache 要等 Listen/channel
// 推回来才刷新。
//
// 现在从 webpack 运行时挖出 ccfolia 用的 `db` 实例和 `setDoc`/`doc`/
// `serverTimestamp` 函数,直接走 SDK 写:
//   1. SDK 同步更新本地 cache,onSnapshot 立刻 fire (hasPendingWrites=true)
//   2. SDK 把 mutation 塞进已存在的 Write/channel,不会让 RID 错位
//   3. 失败时 SDK 自己重试 / 回滚,我们不用管
// 前提:webpack-hook 已跑完,api 已 ready。没 ready 就 fallback 到 REST。

import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { getIdToken } from './auth-token'
import { optimisticUpdateCharacter } from './redux-store'
import { getFirestoreApi } from './webpack-hook'

declare const unsafeWindow: Window & typeof globalThis

const PROJECT = 'ccfolia-160aa'

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

// SDK 路径:直接走 ccfolia 那份 firebase SDK。成功返 true,没 api 返 false。
async function patchStatusViaSdk({ roomId, charId, newStatus }: PatchStatusArgs): Promise<boolean> {
  const api = getFirestoreApi()
  if (!api)
    return false
  const { db, firestore: { doc, setDoc, serverTimestamp } } = api
  const ref = doc(db as never, 'rooms', roomId, 'characters', charId)
  await setDoc(
    ref as never,
    { status: newStatus, updatedAt: serverTimestamp() },
    { merge: true },
  )
  return true
}

// REST 兜底。仅在 webpack hook 还没 ready 时用。
async function patchStatusViaRest({ roomId, charId, newStatus }: PatchStatusArgs): Promise<void> {
  const info = await getIdToken()
  if (!info)
    throw new Error('无法读取 Firebase ID token(未登录 ccfolia?)')

  const body = {
    writes: [{
      update: {
        name: `projects/${PROJECT}/databases/(default)/documents/rooms/${roomId}/characters/${charId}`,
        fields: {
          status: {
            arrayValue: {
              values: newStatus.map(s => ({
                mapValue: {
                  fields: {
                    label: { stringValue: s.label },
                    value: { integerValue: String(s.value) },
                    max: { integerValue: String(s.max) },
                  },
                },
              })),
            },
          },
        },
      },
      updateMask: { fieldPaths: ['status'] },
      updateTransforms: [
        { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
      ],
    }],
  }

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`

  const resp = await unsafeWindow.fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${info.token}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Firestore commit failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 300)}`)
  }
}

export async function patchStatus(args: PatchStatusArgs): Promise<void> {
  const viaSdk = await patchStatusViaSdk(args)
  if (viaSdk)
    return
  await patchStatusViaRest(args)
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
