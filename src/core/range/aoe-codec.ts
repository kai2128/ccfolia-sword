import type { StoredAoe } from './aoe-indicator'
import type { CcfoliaParam } from '@/types/ccfolia'

// AOE 指示器在 ccfolia params 里的存储编解码,与 buff 的 cs_buff_ 同构。
export const AOE_LABEL_PREFIX = 'cs_aoe_'

export function aoeLabel(id: string): string {
  return `${AOE_LABEL_PREFIX}${id}`
}

export function isAoeLabel(label: string): boolean {
  return label.startsWith(AOE_LABEL_PREFIX)
}

export function encodeAoe(aoe: StoredAoe): string {
  return JSON.stringify(aoe)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

export function decodeAoe(raw: string): StoredAoe | null {
  try {
    const p = JSON.parse(raw)
    if (!isRecord(p))
      return null
    if (typeof p.id !== 'string' || typeof p.label !== 'string')
      return null
    if (typeof p.radiusM !== 'number' || !Number.isFinite(p.radiusM))
      return null
    if (typeof p.color !== 'string')
      return null
    if (p.turnsRemaining !== null && typeof p.turnsRemaining !== 'number')
      return null
    return {
      id: p.id,
      label: p.label,
      radiusM: p.radiusM,
      color: p.color,
      turnsRemaining: p.turnsRemaining as number | null,
      enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
    }
  }
  catch {
    return null
  }
}

// ── params RMW ────────────────────────────────────────────
export type AoeOp
  = | { kind: 'set', aoe: StoredAoe } // upsert(按 id)
    | { kind: 'remove', id: string }

export function setAoe(aoe: StoredAoe): AoeOp {
  return { kind: 'set', aoe }
}

export function removeAoe(id: string): AoeOp {
  return { kind: 'remove', id }
}

export function applyAoeOps(params: CcfoliaParam[], ops: AoeOp[]): CcfoliaParam[] {
  let next = params.slice()

  for (const op of ops) {
    if (op.kind === 'remove') {
      const label = aoeLabel(op.id)
      next = next.filter(param => param.label !== label)
      continue
    }

    const label = aoeLabel(op.aoe.id)
    const entry: CcfoliaParam = { label, value: encodeAoe(op.aoe) }
    const index = next.findIndex(param => param.label === label)
    if (index >= 0) {
      next = next.slice()
      next[index] = entry
    }
    else {
      next = [...next, entry]
    }
  }

  return next
}

// 回合衰减:对一个角色的 params 做一次 AOE tick。
// turnsRemaining 为 number 的 -1,到 0(或已 <=0)移除该条目;null 永久保留;非 AOE 条目原样保留。
// 无变化时返回原引用,serializedParamsUpdate 跳过空写。
export function applyAoeTickToParams(current: CcfoliaParam[]): CcfoliaParam[] {
  let dirty = false
  const next: CcfoliaParam[] = []

  for (const param of current) {
    if (!isAoeLabel(param.label)) {
      next.push(param)
      continue
    }
    const aoe = decodeAoe(param.value)
    if (!aoe) {
      next.push(param)
      continue
    }
    if (aoe.turnsRemaining == null) {
      next.push(param)
      continue
    }
    const newTurns = aoe.turnsRemaining - 1
    if (newTurns <= 0) {
      dirty = true
      continue
    }
    next.push({ label: aoeLabel(aoe.id), value: encodeAoe({ ...aoe, turnsRemaining: newTurns }) })
    dirty = true
  }

  return dirty ? next : current
}
