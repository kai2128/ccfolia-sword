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

  for (const target of draft.targets) {
    if (target.bonus !== undefined && (!Number.isInteger(target.bonus) || target.bonus < 0))
      throw new InvalidDraftError(`target ${target.characterId} bonus must be a non-negative integer, got ${target.bonus}`)
    if (target.penalty !== undefined && (!Number.isInteger(target.penalty) || target.penalty < 0))
      throw new InvalidDraftError(`target ${target.characterId} penalty must be a non-negative integer, got ${target.penalty}`)
  }

  if (draft.resistType !== 'none') {
    for (const target of draft.targets) {
      // override 直接给最终值,不再需要抵抗判定
      if (target.finalValueOverride !== undefined)
        continue
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
      rawAfterResist = outcome === 'nullify' ? 0 : Math.ceil(draft.rawValue / 2)
    }
  }

  const computed = draft.damageType === 'physical'
    ? rawAfterResist - resolveDefense(ctx.status, labelMap, ctx.mods)
    : rawAfterResist

  const bonus = target.bonus ?? 0
  const penalty = target.penalty ?? 0
  const finalDamage = Math.max(0, computed + bonus - penalty)

  return {
    finalDamage,
    newHp: ctx.currentHp - finalDamage,
  }
}
