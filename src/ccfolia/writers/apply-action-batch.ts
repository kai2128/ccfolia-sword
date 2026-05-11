import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { StatusUndoChange } from '@/stores/undo-history'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { getCurrentRoomId, patchStatus } from '../firestore-writer'
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

// 对多角色做一次性应用。名字里的 "Batch" 指"一批变更",**不是** Firestore writeBatch。
//
// 刻意不走 writeBatch:
//   - SDK 的 setDoc 在调用瞬间就写本地 cache 并 fire onSnapshot(hasPendingWrites=true),
//     ccfolia Redux 秒更,UI 反馈跟 writeBatch 无差别
//   - writeBatch 唯一的额外保证是"原子提交",但战斗写回并不需要这种跨 doc 原子性
//     (一个目标失败不该让其他目标也不落地,GM 分别看到错误再单独重试更合理)
//   - 绕开 writeBatch 也让 webpack-hook 少扫一个不稳定的指纹(writeBatch 没有
//     稳定字面量,只能靠 `new X(e, t=>Y(e,t))` 这种 regex 匹配)
//
// 仍然需要按 charId 分组:同一角色的多 slot/多 part 必须合并成一次 setDoc,
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
  let done = 0
  onProgress?.(0, total)
  // 即便单个 promise reject,onProgress 也照常自增 —— 用 finally 而不是 then
  await Promise.all(plan.map(p =>
    patchStatus({ roomId, charId: p.char._id, newStatus: p.nextStatus })
      .finally(() => onProgress?.(++done, total)),
  ))

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
