import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { getCurrentRoomId, patchStatus } from '../firestore-writer'

export async function writeStatusValue(args: {
  char: CcfoliaCharacter
  slot: StatusSlot
  newValue: number
  labelMap: StatusLabelMap
  // 多部位场景下传 'XX' / 'X1' 等;非多部位不传,行为同改动前。
  partPrefix?: string
}): Promise<void> {
  const { char, slot, newValue, labelMap, partPrefix = '' } = args
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId,请在 ccfolia 房间里打开')

  const label = partPrefix + labelMap[slot]
  const idx = char.status.findIndex(s => s.label === label)
  if (idx < 0)
    throw new Error(`角色 ${char.name} 缺少 status "${label}"`)

  const nextStatus: CcfoliaStatus[] = char.status.map((s, i) =>
    i === idx ? { ...s, value: newValue } : s,
  )

  await patchStatus({ roomId, charId: char._id, newStatus: nextStatus })
}
