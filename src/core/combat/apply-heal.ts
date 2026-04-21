import type { ActionDraft, ActionTarget } from '@/types/action'

export interface HealContext {
  currentHp: number
  maxHp: number
}

export interface HealResult {
  healedAmount: number
  newHp: number
}

export function applyHealToTarget(
  draft: ActionDraft,
  target: ActionTarget,
  ctx: HealContext,
): HealResult {
  const raw = target.finalValueOverride ?? draft.rawValue
  const newHp = Math.min(ctx.currentHp + raw, ctx.maxHp)
  return {
    healedAmount: newHp - ctx.currentHp,
    newHp,
  }
}
