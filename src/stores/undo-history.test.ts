import type { CcfoliaStatus } from '@/types/ccfolia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const patchStatusSpy = vi.fn().mockResolvedValue(undefined)
let mockRoomId: string | null = 'room-1'

vi.mock('@/ccfolia/firestore-writer', () => ({
  getCurrentRoomId: () => mockRoomId,
  patchStatus: patchStatusSpy,
}))

const { useUndoHistoryStore } = await import('./undo-history')

function status(label: string, value: number, max = 25): CcfoliaStatus {
  return { label, value, max }
}

beforeEach(() => {
  setActivePinia(createPinia())
  patchStatusSpy.mockClear()
  mockRoomId = 'room-1'
})

describe('useUndoHistoryStore', () => {
  it('push 的条目能被 undo:重新调用 patchStatus 写回 beforeStatus', async () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({
      label: '调整',
      changes: [{ charId: 'c1', beforeStatus: before, afterStatus: after }],
    })

    expect(store.undoStack.length).toBe(1)

    const ok = await store.undo()
    expect(ok).toBe(true)
    expect(patchStatusSpy).toHaveBeenCalledWith({ roomId: 'room-1', charId: 'c1', newStatus: before })
    expect(store.undoStack.length).toBe(0)
    expect(store.redoStack.length).toBe(1)
  })

  it('redo 把 entry 写回 afterStatus 并放回 undo 栈', async () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({ label: 'x', changes: [{ charId: 'c1', beforeStatus: before, afterStatus: after }] })
    await store.undo()
    patchStatusSpy.mockClear()

    const ok = await store.redo()
    expect(ok).toBe(true)
    expect(patchStatusSpy).toHaveBeenCalledWith({ roomId: 'room-1', charId: 'c1', newStatus: after })
    expect(store.undoStack.length).toBe(1)
    expect(store.redoStack.length).toBe(0)
  })

  it('新 push 清空 redo 栈', async () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({ label: 'a', changes: [{ charId: 'c1', beforeStatus: before, afterStatus: after }] })
    await store.undo()
    expect(store.redoStack.length).toBe(1)

    store.push({ label: 'b', changes: [{ charId: 'c2', beforeStatus: before, afterStatus: after }] })
    expect(store.redoStack.length).toBe(0)
  })

  it('超过 10 条上限时丢掉最旧的', () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    for (let i = 0; i < 15; i++) {
      store.push({
        label: `e${i}`,
        changes: [{ charId: `c${i}`, beforeStatus: before, afterStatus: after }],
      })
    }
    expect(store.undoStack.length).toBe(10)
    expect(store.undoStack[0].label).toBe('e5')
    expect(store.undoStack[9].label).toBe('e14')
  })

  it('roomId 切换后再 push 会清掉前一个房间的栈', () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({ label: 'in room-1', changes: [{ charId: 'c1', beforeStatus: before, afterStatus: after }] })

    mockRoomId = 'room-2'
    store.push({ label: 'in room-2', changes: [{ charId: 'c2', beforeStatus: before, afterStatus: after }] })

    expect(store.undoStack.length).toBe(1)
    expect(store.undoStack[0].label).toBe('in room-2')
    expect(store.undoStack[0].roomId).toBe('room-2')
  })

  it('undo 时房间已切走则清空双栈拒绝执行', async () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({ label: 'x', changes: [{ charId: 'c1', beforeStatus: before, afterStatus: after }] })

    mockRoomId = 'room-2'
    const ok = await store.undo()
    expect(ok).toBe(false)
    expect(patchStatusSpy).not.toHaveBeenCalled()
    expect(store.undoStack.length).toBe(0)
    expect(store.redoStack.length).toBe(0)
  })

  it('多角色 changes 一次性回滚:对每个 charId 各调一次 patchStatus', async () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({
      label: '批量',
      changes: [
        { charId: 'c1', beforeStatus: before, afterStatus: after },
        { charId: 'c2', beforeStatus: before, afterStatus: after },
      ],
    })
    await store.undo()
    expect(patchStatusSpy).toHaveBeenCalledTimes(2)
  })

  it('undo 失败时把条目放回栈,允许重试', async () => {
    const store = useUndoHistoryStore()
    const before = [status('HP', 25)]
    const after = [status('HP', 10)]
    store.push({ label: 'x', changes: [{ charId: 'c1', beforeStatus: before, afterStatus: after }] })

    patchStatusSpy.mockRejectedValueOnce(new Error('boom'))
    const ok = await store.undo()
    expect(ok).toBe(false)
    expect(store.undoStack.length).toBe(1)
    expect(store.redoStack.length).toBe(0)
  })

  it('changes 为空时 push 是 no-op', () => {
    const store = useUndoHistoryStore()
    store.push({ label: 'noop', changes: [] })
    expect(store.undoStack.length).toBe(0)
  })
})
