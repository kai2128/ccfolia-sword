import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { StatusUndoChange } from '@/stores/undo-history'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { commitWriteBatch, getCurrentRoomId, patchStatus } from '../firestore-writer'
import { getFirestoreApi } from '../webpack-hook'
import { recordStatusUndo } from './_undo-helper'

export interface StatusChange {
  char: CcfoliaCharacter
  slot: StatusSlot
  newValue: number
  partPrefix?: string
}

interface CharGroup {
  char: CcfoliaCharacter
  edits: Array<{ slot: StatusSlot, newValue: number, partPrefix: string }>
}

function applyStatusEdit(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  newValue: number,
  labelMap: StatusLabelMap,
  partPrefix: string,
  charName: string,
): CcfoliaStatus[] {
  const label = partPrefix + labelMap[slot]
  const index = status.findIndex(item => item.label === label)
  if (index < 0)
    throw new Error(`角色 ${charName} 缺少 status "${label}"`)

  return status.map((item, currentIndex) =>
    currentIndex === index ? { ...item, value: newValue } : item,
  )
}

// 对多角色做一次性应用。名字里的 "Batch" 指"一批变更"。
//
// 写入策略(2026-05 改):
//   1. 优先用 firestore writeBatch ——
//      N 个角色合成 1 个 RPC,把 SDK WriteStream 的 ack-by-ack 串行降级成一次 round-trip。
//      300 角色实测从分钟级降到秒级。
//   2. webpack-hook 没抓到 writeBatch(老 ccfolia / 指纹失配)→
//      回退到 Promise.all(setDoc),即原来的"并行 setDoc"路径。
//
// 仍然需要按 charId 分组:同一角色的多 slot/多 part 必须合并成一次写,
// 否则 `{ merge: true }` 对 `status` 数组是字段级整体替换,后一次 set 会覆盖前一次。
export async function applyStatusChangesBatch(
  changes: StatusChange[],
  labelMap: StatusLabelMap,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (changes.length === 0) {
    onProgress?.(0, 0)
    return
  }

  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const byChar = new Map<string, CharGroup>()
  for (const change of changes) {
    const partPrefix = change.partPrefix ?? ''
    const current = byChar.get(change.char._id)
    if (current) {
      current.edits.push({ slot: change.slot, newValue: change.newValue, partPrefix })
      continue
    }

    byChar.set(change.char._id, {
      char: change.char,
      edits: [{ slot: change.slot, newValue: change.newValue, partPrefix }],
    })
  }

  // 先把每个角色的 before / after 算好,再统一 patchStatus。
  // Promise.all 全部 resolve 后才记录 undo,任一失败就不记 —— 与"乐观并行写"现状对齐
  // (本来就没有部分失败回滚机制,这里只确保 undo 不会指向半成品)。
  const plan = [...byChar.values()].map(({ char, edits }) => {
    let nextStatus = char.status
    for (const edit of edits)
      nextStatus = applyStatusEdit(nextStatus, edit.slot, edit.newValue, labelMap, edit.partPrefix, char.name)
    return { char, beforeStatus: char.status, nextStatus }
  })

  const total = plan.length
  const hasWriteBatch = !!getFirestoreApi()?.firestore.writeBatch

  if (hasWriteBatch) {
    // 优先路径:writeBatch,1 个 RPC(>400 时分 chunk 并行)。
    // commitWriteBatch 内部会自己喂 onProgress(0,total) 起步。
    await commitWriteBatch(
      roomId,
      plan.map(p => ({ charId: p.char._id, patch: { status: p.nextStatus } })),
      onProgress,
    )
  }
  else {
    // 回退路径:webpack-hook 没抓到 writeBatch —— 退回到并行 setDoc。
    let done = 0
    onProgress?.(0, total)
    // 即便单个 promise reject,onProgress 也照常自增 —— 用 finally 而不是 then
    await Promise.all(plan.map(p =>
      patchStatus({ roomId, charId: p.char._id, newStatus: p.nextStatus })
        .finally(() => onProgress?.(++done, total)),
    ))
  }

  const undoChanges: StatusUndoChange[] = plan.map(p => ({
    charId: p.char._id,
    beforeStatus: p.beforeStatus,
    afterStatus: p.nextStatus,
  }))
  const label = plan.length === 1
    ? `调整 ${plan[0].char.name}`
    : `批量调整 ${plan.length} 名角色`
  recordStatusUndo({ label, changes: undoChanges })
}
