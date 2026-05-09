// HP/MP 写入的 undo / redo 栈。两条独立栈,纯客户端、不持久化。
//
// 我们绕过了 ccfolia 自己的 Redux dispatcher 直接 setDoc,所以原生 Ctrl+Z 看不到
// 这边的写入。这里保存写前 / 写后的整段 status 数组,撤销时再走一遍 patchStatus。
//
// 与 ccfolia 原生 undo 同语义:粗暴覆盖,中间他人改动也直接顶掉,不满意就再 redo。

import type { CcfoliaStatus } from '@/types/ccfolia'
import { defineStore } from 'pinia'
import { getCurrentRoomId, patchStatus } from '@/ccfolia/firestore-writer'
import { createLogger } from '@/infra/log'

const log = createLogger('undo')

const MAX_ENTRIES = 10

export interface StatusUndoChange {
  charId: string
  beforeStatus: CcfoliaStatus[]
  afterStatus: CcfoliaStatus[]
}

export interface StatusUndoEntry {
  id: string
  label: string
  timestamp: number
  roomId: string
  changes: StatusUndoChange[]
}

interface UndoHistoryState {
  undoStack: StatusUndoEntry[]
  redoStack: StatusUndoEntry[]
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useUndoHistoryStore = defineStore('undo-history', {
  state: (): UndoHistoryState => ({
    undoStack: [],
    redoStack: [],
  }),
  actions: {
    push(input: { label: string, changes: StatusUndoChange[] }) {
      if (input.changes.length === 0)
        return
      const roomId = getCurrentRoomId()
      if (!roomId)
        return

      // 换房间就把残留快照清掉,避免跨房间回放。
      const top = this.undoStack[this.undoStack.length - 1] ?? this.redoStack[this.redoStack.length - 1]
      if (top && top.roomId !== roomId) {
        this.undoStack = []
        this.redoStack = []
      }

      const entry: StatusUndoEntry = {
        id: makeId(),
        label: input.label,
        timestamp: Date.now(),
        roomId,
        changes: input.changes,
      }
      this.undoStack.push(entry)
      if (this.undoStack.length > MAX_ENTRIES)
        this.undoStack.shift()
      // 新动作清空 redo,标准语义。
      this.redoStack = []
    },

    async undo(): Promise<boolean> {
      const entry = this.undoStack[this.undoStack.length - 1]
      if (!entry)
        return false
      const roomId = getCurrentRoomId()
      if (roomId !== entry.roomId) {
        log.warn('undo: roomId mismatch, clearing stacks', { entryRoom: entry.roomId, current: roomId })
        this.undoStack = []
        this.redoStack = []
        return false
      }

      // 先 pop 再写回,失败时再塞回去。这样 redo 栈是 push 的,顺序对。
      this.undoStack.pop()
      try {
        await Promise.all(entry.changes.map(c =>
          patchStatus({ roomId, charId: c.charId, newStatus: c.beforeStatus }),
        ))
        this.redoStack.push(entry)
        if (this.redoStack.length > MAX_ENTRIES)
          this.redoStack.shift()
        log.info('undo applied', { label: entry.label, count: entry.changes.length })
        return true
      }
      catch (e) {
        log.error('undo failed', { label: entry.label, error: e })
        this.undoStack.push(entry)
        return false
      }
    },

    async redo(): Promise<boolean> {
      const entry = this.redoStack[this.redoStack.length - 1]
      if (!entry)
        return false
      const roomId = getCurrentRoomId()
      if (roomId !== entry.roomId) {
        log.warn('redo: roomId mismatch, clearing stacks', { entryRoom: entry.roomId, current: roomId })
        this.undoStack = []
        this.redoStack = []
        return false
      }

      this.redoStack.pop()
      try {
        await Promise.all(entry.changes.map(c =>
          patchStatus({ roomId, charId: c.charId, newStatus: c.afterStatus }),
        ))
        this.undoStack.push(entry)
        if (this.undoStack.length > MAX_ENTRIES)
          this.undoStack.shift()
        log.info('redo applied', { label: entry.label, count: entry.changes.length })
        return true
      }
      catch (e) {
        log.error('redo failed', { label: entry.label, error: e })
        this.redoStack.push(entry)
        return false
      }
    },

    clear() {
      this.undoStack = []
      this.redoStack = []
    },
  },
})
