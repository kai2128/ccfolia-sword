export type Adjustment
  = | { kind: 'absolute', value: number }
    | { kind: 'delta', value: number }

// HP/MP 默认允许超过上限(过量治疗、临时 buff 等);传 clampMax=true 时才截到 max。
// HP 允许负值(昏迷/濒死);MP 始终在 0 处截断。
export function clampHp(value: number, max: number, clampMax = false): number {
  return clampMax ? Math.min(value, max) : value
}

export function clampMp(value: number, max: number, clampMax = false): number {
  const floored = Math.max(0, value)
  return clampMax ? Math.min(floored, max) : floored
}

export function parseAdjustment(raw: string): Adjustment | null {
  const s = raw.trim()
  if (!s)
    return null

  // 显式绝对值前缀 "=-5" / "=5"
  if (s.startsWith('=')) {
    const n = Number(s.slice(1))
    return Number.isFinite(n) && Number.isInteger(n) ? { kind: 'absolute', value: n } : null
  }

  // delta:+N / -N
  if (/^[+-]\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) ? { kind: 'delta', value: n } : null
  }

  // 纯整数:绝对值
  if (/^\d+$/.test(s))
    return { kind: 'absolute', value: Number(s) }

  return null
}

export function resolveNewValue(
  adj: Adjustment,
  current: number,
  max: number,
  kind: 'hp' | 'mp',
  options: { clampMax?: boolean } = {},
): number {
  const { clampMax = false } = options
  const raw = adj.kind === 'absolute' ? adj.value : current + adj.value
  return kind === 'hp' ? clampHp(raw, max, clampMax) : clampMp(raw, max, clampMax)
}
