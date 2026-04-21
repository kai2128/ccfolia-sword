import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { getCurrentRoomId } from '../firestore-writer'
import { getFirestoreApi } from '../webpack-hook'

export interface StatusChange {
  char: CcfoliaCharacter
  slot: StatusSlot
  newValue: number
}

interface WriteBatchLike {
  set: (ref: unknown, data: unknown, options?: { merge?: boolean }) => void
  commit: () => Promise<void>
}

interface CharGroup {
  char: CcfoliaCharacter
  edits: Array<{ slot: StatusSlot, newValue: number }>
}

function applyStatusEdit(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  newValue: number,
  labelMap: StatusLabelMap,
  charName: string,
): CcfoliaStatus[] {
  const label = labelMap[slot]
  const index = status.findIndex(item => item.label === label)
  if (index < 0)
    throw new Error(`角色 ${charName} 缺少 status "${label}"`)

  return status.map((item, currentIndex) =>
    currentIndex === index ? { ...item, value: newValue } : item,
  )
}

export async function applyStatusChangesBatch(
  changes: StatusChange[],
  labelMap: StatusLabelMap,
): Promise<void> {
  if (changes.length === 0)
    return

  const api = getFirestoreApi()
  if (!api)
    throw new Error('Firebase SDK 还没挂钩完成')

  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')

  const { db, firestore } = api
  const { doc, writeBatch, serverTimestamp } = firestore
  if (typeof writeBatch !== 'function')
    throw new Error('Firebase SDK 未暴露 writeBatch(webpack scan 未命中)')

  const batch = writeBatch(db as never) as WriteBatchLike
  const byChar = new Map<string, CharGroup>()

  for (const change of changes) {
    const current = byChar.get(change.char._id)
    if (current) {
      current.edits.push({ slot: change.slot, newValue: change.newValue })
      continue
    }

    byChar.set(change.char._id, {
      char: change.char,
      edits: [{ slot: change.slot, newValue: change.newValue }],
    })
  }

  for (const { char, edits } of byChar.values()) {
    let nextStatus = char.status
    for (const edit of edits)
      nextStatus = applyStatusEdit(nextStatus, edit.slot, edit.newValue, labelMap, char.name)

    const ref = doc(db as never, 'rooms', roomId, 'characters', char._id)
    batch.set(ref, { status: nextStatus, updatedAt: serverTimestamp() }, { merge: true })
  }

  await batch.commit()
}
