// 按精确 label 增减 character.status[] 中的某条数值。
// **不会**新建条目 —— label 不存在直接抛错;调用方应先确认条目存在。
// 值最低截到 0,不限上限(允许超量堆叠)。

import type { CcfoliaCharacter } from '@/types/ccfolia'
import { getCurrentRoomId, patchStatus } from '../firestore-writer'
import { recordStatusUndo } from './_undo-helper'

export async function adjustStatusByLabel(args: {
  char: CcfoliaCharacter
  label: string
  delta: number
}): Promise<void> {
  const { char, label, delta } = args
  if (delta === 0)
    return
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId,请在 ccfolia 房间里打开')

  const idx = char.status.findIndex(s => s.label === label)
  if (idx < 0)
    throw new Error(`角色 ${char.name} 缺少 status "${label}"`)

  const beforeStatus = char.status
  const nextStatus = char.status.map((s, i) =>
    i === idx ? { ...s, value: Math.max(0, s.value + delta) } : s,
  )

  await patchStatus({ roomId, charId: char._id, newStatus: nextStatus })

  recordStatusUndo({
    label: `${char.name} ${label} ${delta > 0 ? '+' : ''}${delta}`,
    changes: [{ charId: char._id, beforeStatus, afterStatus: nextStatus }],
  })
}
