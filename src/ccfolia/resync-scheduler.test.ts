import { describe, expect, it, vi } from 'vitest'
import { makeResyncScheduler } from './resync-scheduler'

// 手动驱动的假环境:frame/timer 回调存起来,测试里手动触发。
function makeHarness(startNow = 1000) {
  let now = startNow
  let frameCb: (() => void) | null = null
  const timers: Array<{ id: number, cb: () => void, at: number }> = []
  let nextId = 1
  const run = vi.fn()

  const deps = {
    now: () => now,
    requestFrame: (cb: () => void) => {
      frameCb = cb
      return 1
    },
    cancelFrame: () => { frameCb = null },
    setTimer: (cb: () => void, ms: number) => {
      const id = nextId++
      timers.push({ id, cb, at: now + ms })
      return id
    },
    clearTimer: (id: number) => {
      const i = timers.findIndex(t => t.id === id)
      if (i >= 0)
        timers.splice(i, 1)
    },
    run,
  }
  return {
    deps,
    run,
    flushFrame() {
      const cb = frameCb
      frameCb = null
      cb?.()
    },
    advance(ms: number) {
      now += ms
      const due = timers.filter(t => t.at <= now)
      for (const t of due) {
        timers.splice(timers.indexOf(t), 1)
        t.cb()
      }
    },
    hasFrame: () => frameCb !== null,
    pendingTimers: () => timers.length,
  }
}

describe('makeResyncScheduler', () => {
  it('runs on next frame when idle (leading)', () => {
    const h = makeHarness()
    const s = makeResyncScheduler(h.deps, 50)
    s.notify()
    expect(h.run).toHaveBeenCalledTimes(0) // 还没到帧
    h.flushFrame()
    expect(h.run).toHaveBeenCalledTimes(1)
  })

  it('coalesces a burst into throttled runs with trailing', () => {
    const h = makeHarness()
    const s = makeResyncScheduler(h.deps, 50)

    // 第一次:leading,下一帧跑
    s.notify()
    h.flushFrame()
    expect(h.run).toHaveBeenCalledTimes(1)

    // burst:间隔内多次 notify 合并成一次 trailing
    s.notify()
    s.notify()
    s.notify()
    expect(h.run).toHaveBeenCalledTimes(1) // 还没到 throttle 窗口
    h.advance(50) // 到了 lastRun + throttle
    expect(h.run).toHaveBeenCalledTimes(2) // 尾帧跑了一次
  })

  it('does not double-schedule while one run is pending', () => {
    const h = makeHarness()
    const s = makeResyncScheduler(h.deps, 50)
    s.notify()
    s.notify()
    expect(h.hasFrame()).toBe(true)
    expect(h.pendingTimers()).toBe(0) // 合并,不重复排期
  })

  it('cancel() stops pending runs', () => {
    const h = makeHarness()
    const s = makeResyncScheduler(h.deps, 50)
    s.notify()
    s.cancel()
    h.flushFrame()
    h.advance(100)
    expect(h.run).toHaveBeenCalledTimes(0)
  })
})
