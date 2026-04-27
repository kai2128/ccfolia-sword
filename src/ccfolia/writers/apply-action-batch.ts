import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { getCurrentRoomId, patchStatus } from '../firestore-writer'

export interface StatusChange {
  char: CcfoliaCharacter
  slot: StatusSlot
  newValue: number
  // 多部位:写到 ${partPrefix}${labelMap[slot]} 的 label;不传 = 整体 / 单部位
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

// 对多角色做一次性应用。多部位时同一 char 多 part 的多 slot 仍合并成一次 setDoc,
// 因为它们写的是 status 数组里不同的 label,合并不冲突。
export async function applyStatusChangesBatch(
  changes: StatusChange[],
  labelMap: StatusLabelMap,
): Promise<void> {
  if (changes.length === 0)
    return

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

  await Promise.all(
    [...byChar.values()].map(({ char, edits }) => {
      let nextStatus = char.status
      for (const edit of edits)
        nextStatus = applyStatusEdit(nextStatus, edit.slot, edit.newValue, labelMap, edit.partPrefix, char.name)
      return patchStatus({ roomId, charId: char._id, newStatus: nextStatus })
    }),
  )
}
