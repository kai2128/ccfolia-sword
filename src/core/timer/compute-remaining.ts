// 倒计时纯函数:把 store 里的"开始时间锚点 + 暂停剩余秒"翻译成实时剩余,以及对应的状态阶梯。
// state.startedAt = null  → 暂停或未启动,remaining = remainingSec
// state.startedAt 有值    → running,remaining = remainingSec - (now - startedAt) / 1000
// remaining 永远不小于 0;到 0 即视为 expired。

export interface TimerState {
  totalSec: number
  remainingSec: number
  startedAt: number | null
}

export type SessionState = 'normal' | 'warning' | 'critical' | 'expired'

export function computeRemaining(state: TimerState, nowMs: number): number {
  const base = state.startedAt == null
    ? state.remainingSec
    : state.remainingSec - (nowMs - state.startedAt) / 1000
  return Math.max(0, base)
}

// 阶梯阈值按百分比:warning ≤ 33%(剩 1/3),critical ≤ 10%。0 直接 expired。
// 百分比相对 totalSec —— 短计时(几分钟)和长计时(数小时)都能合理触发。
// totalSec ≤ 0 时退化只用绝对值判断 expired。
export function getSessionState(remainingSec: number, totalSec: number): SessionState {
  if (remainingSec <= 0)
    return 'expired'
  if (totalSec <= 0)
    return 'normal'
  const pct = remainingSec / totalSec
  if (pct <= 0.10)
    return 'critical'
  if (pct <= 1 / 3)
    return 'warning'
  return 'normal'
}

export function fmtHMS(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
