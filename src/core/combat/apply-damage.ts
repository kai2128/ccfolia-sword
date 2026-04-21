import type { ModifierContribution } from './resolve-modifiers'
import type { StatusLabelMap } from '@/core/status-slot'
import type { ActionDraft, ActionTarget } from '@/types/action'
import type { CcfoliaStatus } from '@/types/ccfolia'
import { InvalidDraftError } from '@/types/action'
import { resolveDefense } from './resolve-modifiers'

export interface TargetContext {
  status: CcfoliaStatus[]
  mods: ModifierContribution[]
  currentHp: number
}

export interface DamageResult {
  finalDamage: number
  newHp: number
}

export function validateDraft(draft: ActionDraft): void {
  if (draft.kind === 'damage' && !draft.damageType)
    throw new InvalidDraftError('damage draft requires damageType')

  // 纯函数层兜底,避免 number input 把负数/小数漏进结算链。
  if (!Number.isInteger(draft.rawValue) || draft.rawValue < 0)
    throw new InvalidDraftError(`rawValue must be a non-negative integer, got ${draft.rawValue}`)

  if (draft.mpCost !== undefined && (!Number.isInteger(draft.mpCost) || draft.mpCost < 0))
    throw new InvalidDraftError(`mpCost must be a non-negative integer, got ${draft.mpCost}`)

  if (draft.resistType !== 'none') {
    for (const target of draft.targets) {
      if (!target.resistResult)
        throw new InvalidDraftError(`target ${target.characterId} missing resistResult`)
    }
  }
}

export function applyDamageToTarget(
  draft: ActionDraft,
  target: ActionTarget,
  ctx: TargetContext,
  labelMap: StatusLabelMap,
): DamageResult {
  if (target.finalValueOverride !== undefined) {
    return {
      finalDamage: target.finalValueOverride,
      newHp: ctx.currentHp - target.finalValueOverride,
    }
  }

  let rawAfterResist = draft.rawValue
  if (draft.resistType !== 'none') {
    if (!target.resistResult)
      throw new InvalidDraftError(`target ${target.characterId} missing resistResult`)

    if (target.resistResult === 'success') {
      const outcome = target.resistOutcome ?? 'half'
      rawAfterResist = outcome === 'nullify' ? 0 : Math.floor(draft.rawValue / 2)
    }
  }

  const finalDamage = draft.damageType === 'physical'
    ? Math.max(0, rawAfterResist - resolveDefense(ctx.status, labelMap, ctx.mods))
    : rawAfterResist

  return {
    finalDamage,
    newHp: ctx.currentHp - finalDamage,
  }
}
