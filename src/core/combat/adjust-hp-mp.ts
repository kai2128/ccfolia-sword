export type Adjustment
  = | { kind: 'absolute', value: number }
    | { kind: 'delta', value: number }

export function clampHp(value: number, max: number): number {
  return Math.min(value, max)
}

export function clampMp(value: number, max: number): number {
  return Math.min(Math.max(0, value), max)
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
): number {
  const raw = adj.kind === 'absolute' ? adj.value : current + adj.value
  return kind === 'hp' ? clampHp(raw, max) : clampMp(raw, max)
}
