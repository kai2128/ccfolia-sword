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
  // override 是 hard override,不再叠加 bonus/penalty;否则叠加并截至 0
  const raw = target.finalValueOverride !== undefined
    ? target.finalValueOverride
    : Math.max(0, draft.rawValue + (target.bonus ?? 0) - (target.penalty ?? 0))
  const newHp = Math.min(ctx.currentHp + raw, ctx.maxHp)
  return {
    healedAmount: newHp - ctx.currentHp,
    newHp,
  }
}
