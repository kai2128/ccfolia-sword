import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { extractParts } from '@/core/character/parts'
import { useSettingsStore } from '@/stores/settings'
import { getCurrentRoomId, patchStatus } from '../firestore-writer'
import { recordStatusUndo } from './_undo-helper'

export interface RestoreResult {
  nextStatus: CcfoliaStatus[]
  changed: boolean
}

// 纯函数:遍历每个 part 的 hp / mp label,把 status 数组里对应条目 value 设为 max。
// 缺 max(NaN / 非 number / 等等)或 value 已在 max 时跳过,避免无意义写。
export function computeRestoredStatus(
  char: CcfoliaCharacter,
  labelMap: StatusLabelMap,
): RestoreResult {
  const targets = new Set<string>()
  for (const part of extractParts(char, labelMap)) {
    targets.add(part.hpLabel)
    if (part.mpLabel)
      targets.add(part.mpLabel)
  }

  let changed = false
  const nextStatus = char.status.map((s) => {
    if (!targets.has(s.label))
      return s
    if (typeof s.max !== 'number' || !Number.isFinite(s.max))
      return s
    if (s.value === s.max)
      return s
    changed = true
    return { ...s, value: s.max }
  })

  return { nextStatus, changed }
}

export async function restoreHpMpToMax(char: CcfoliaCharacter): Promise<void> {
  const roomId = getCurrentRoomId()
  if (!roomId)
    return
  const labelMap = useSettingsStore().statusLabelMap
  const { nextStatus, changed } = computeRestoredStatus(char, labelMap)
  if (!changed)
    return

  const beforeStatus = char.status
  await patchStatus({ roomId, charId: char._id, newStatus: nextStatus })

  recordStatusUndo({
    label: `${char.name} 恢复 HP/MP`,
    changes: [{ charId: char._id, beforeStatus, afterStatus: nextStatus }],
  })
}
