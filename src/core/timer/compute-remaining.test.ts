import { describe, expect, it } from 'vitest'
import { computeRemaining, fmtHMS, getSessionState } from './compute-remaining'

describe('computeRemaining', () => {
  it('暂停状态(startedAt=null)直接返回 remainingSec', () => {
    expect(computeRemaining({ totalSec: 180, remainingSec: 90, startedAt: null }, 9_999_999)).toBe(90)
  })

  it('running 状态扣掉已过 wall-clock', () => {
    const now = 1_000_000
    const state = { totalSec: 180, remainingSec: 100, startedAt: now - 10_000 } // 已经走 10s
    expect(computeRemaining(state, now)).toBe(90)
  })

  it('剩余永远不小于 0', () => {
    const now = 1_000_000
    const state = { totalSec: 60, remainingSec: 5, startedAt: now - 100_000 }
    expect(computeRemaining(state, now)).toBe(0)
  })

  it('startedAt 等于 now 时不扣秒', () => {
    const now = 500
    expect(computeRemaining({ totalSec: 60, remainingSec: 30, startedAt: now }, now)).toBe(30)
  })
})

describe('getSessionState', () => {
  // total = 600s(10 分钟)→ warning ≤ 200s(1/3),critical ≤ 60s(10%)
  it('> 1/3 是 normal', () => {
    expect(getSessionState(400, 600)).toBe('normal')
    expect(getSessionState(201, 600)).toBe('normal')
  })
  it('1/3 临界点是 warning', () => {
    expect(getSessionState(200, 600)).toBe('warning')
  })
  it('10% 临界点是 critical', () => {
    expect(getSessionState(60, 600)).toBe('critical')
  })
  it('> 10% && <= 1/3 是 warning', () => {
    expect(getSessionState(120, 600)).toBe('warning')
  })
  it('0 或负数是 expired,无视 total', () => {
    expect(getSessionState(0, 600)).toBe('expired')
    expect(getSessionState(-5, 600)).toBe('expired')
  })
  it('totalSec=0 时除 expired 外都按 normal 兜底', () => {
    expect(getSessionState(10, 0)).toBe('normal')
    expect(getSessionState(0, 0)).toBe('expired')
  })
  it('短计时(60s)阈值依然按百分比触发', () => {
    expect(getSessionState(20, 60)).toBe('warning') // 33%
    expect(getSessionState(6, 60)).toBe('critical') // 10%
  })
})

describe('fmtHMS', () => {
  it('整时整分整秒', () => {
    expect(fmtHMS(0)).toBe('00:00:00')
    expect(fmtHMS(59)).toBe('00:00:59')
    expect(fmtHMS(60)).toBe('00:01:00')
    expect(fmtHMS(3600)).toBe('01:00:00')
    expect(fmtHMS(3661)).toBe('01:01:01')
  })

  it('小数秒向上取整', () => {
    expect(fmtHMS(0.4)).toBe('00:00:01') // 还没到 0,显示要 1 秒
    expect(fmtHMS(59.99)).toBe('00:01:00')
  })

  it('负数夹到 0', () => {
    expect(fmtHMS(-10)).toBe('00:00:00')
  })
})
