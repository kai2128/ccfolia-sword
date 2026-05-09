// writer 完成 setDoc 后的统一 undo 入口。三个 HP/MP writer 都过这里,
// 后续要扩展(buff / tag 等)在这里加 label / changes 形态即可。

import type { StatusUndoChange } from '@/stores/undo-history'
import { useUndoHistoryStore } from '@/stores/undo-history'

export function recordStatusUndo(input: { label: string, changes: StatusUndoChange[] }): void {
  if (input.changes.length === 0)
    return
  useUndoHistoryStore().push(input)
}
