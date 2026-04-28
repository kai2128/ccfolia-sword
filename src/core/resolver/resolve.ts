import type { ActionDraft, HitStatus, Resolution, ResolvedTarget, Target } from './types'
import type { PowerTable } from '@/types/power-table'
import { evaluatePowerCommand } from './k-syntax/evaluate'
import { parsePowerCommand } from './k-syntax/parse'

export function resolve(draft: ActionDraft, tables: Record<string, PowerTable>): Resolution {
  const { rawDamageBase, parseError } = computeRawDamageBase(draft, tables)

  return {
    draft,
    rawDamageBase,
    parseError,
    targets: draft.targets.map(target => resolveTarget(target, draft, rawDamageBase)),
  }
}

function computeRawDamageBase(
  draft: ActionDraft,
  tables: Record<string, PowerTable>,
): { rawDamageBase: number | null, parseError?: string } {
  // 简化路径：GM 直接填入原伤害，跳过威力表/公式。
  if (draft.rawDamage !== undefined)
    return { rawDamageBase: draft.rawDamage }

  if (!draft.powerExpr.trim())
    return { rawDamageBase: null }
  if (draft.dice1 === undefined || draft.dice2 === undefined)
    return { rawDamageBase: null }
  if (!draft.powerTableId)
    return { rawDamageBase: null }

  const table = tables[draft.powerTableId]
  if (!table)
    return { rawDamageBase: null }

  const parsed = parsePowerCommand(draft.powerExpr)
  if (!parsed.ok)
    return { rawDamageBase: null, parseError: parsed.reason }

  try {
    const result = evaluatePowerCommand(parsed.value, table, {
      main: [draft.dice1, draft.dice2],
      crits: draft.critDice,
    })
    return { rawDamageBase: result.total }
  }
  catch (error) {
    return {
      rawDamageBase: null,
      parseError: error instanceof Error ? error.message : String(error),
    }
  }
}

function resolveTarget(
  target: Target,
  draft: ActionDraft,
  rawDamageBase: number | null,
): ResolvedTarget {
  const hit = computeHit(target, draft)
  const rawDamage = target.rawDamageOverride ?? rawDamageBase
  const finalDamage = computeFinalDamage(target, draft, hit, rawDamage)

  return {
    id: target.id,
    name: target.name,
    hit,
    rawDamage,
    finalDamage,
    isHitOverridden: target.hitOverride !== undefined,
    isRawDamageOverridden: target.rawDamageOverride !== undefined,
    isFinalDamageOverridden: target.finalDamageOverride !== undefined,
  }
}

function computeHit(target: Target, draft: ActionDraft): HitStatus {
  if (target.hitOverride !== undefined)
    return target.hitOverride

  if (draft.kind === 'physical') {
    if (draft.attackRoll === undefined || target.evasion === undefined)
      return 'unknown'
    return target.evasion < draft.attackRoll
  }

  if (draft.castingRoll === undefined || target.resistValue === undefined)
    return 'unknown'
  return target.resistValue < draft.castingRoll
}

function computeFinalDamage(
  target: Target,
  draft: ActionDraft,
  hit: HitStatus,
  rawDamage: number | null,
): number | null {
  if (target.finalDamageOverride !== undefined)
    return target.finalDamageOverride

  if (draft.kind === 'physical') {
    if (hit === false)
      return 0
    if (hit === 'unknown' || rawDamage === null)
      return null
    return Math.max(0, rawDamage - (target.defense ?? 0))
  }

  if (rawDamage === null || hit === 'unknown')
    return null
  if (hit === false)
    return draft.resistOutcome === 'nullify' ? 0 : Math.ceil(rawDamage / 2)
  return rawDamage
}
