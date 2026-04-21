import type { ActionDraft } from '@/types/action'
import { describe, expect, it } from 'vitest'
import { applyHealToTarget } from './apply-heal'

function draft(partial: Partial<ActionDraft>): ActionDraft {
  return {
    id: 'h1',
    kind: 'heal',
    rawValue: 10,
    resistType: 'none',
    targets: [],
    ...partial,
  }
}

describe('applyHealToTarget', () => {
  it('adds raw value to current hp', () => {
    const result = applyHealToTarget(draft({ rawValue: 5 }), { characterId: 'c1' }, { currentHp: 10, maxHp: 25 })
    expect(result.healedAmount).toBe(5)
    expect(result.newHp).toBe(15)
  })

  it('does not exceed max hp', () => {
    const result = applyHealToTarget(draft({ rawValue: 50 }), { characterId: 'c1' }, { currentHp: 22, maxHp: 25 })
    expect(result.healedAmount).toBe(3)
    expect(result.newHp).toBe(25)
  })

  it('heals from negative hp toward max', () => {
    const result = applyHealToTarget(draft({ rawValue: 15 }), { characterId: 'c1' }, { currentHp: -5, maxHp: 25 })
    expect(result.healedAmount).toBe(15)
    expect(result.newHp).toBe(10)
  })

  it('uses finalValueOverride', () => {
    const result = applyHealToTarget(draft({ rawValue: 5 }), { characterId: 'c1', finalValueOverride: 20 }, { currentHp: 10, maxHp: 25 })
    expect(result.healedAmount).toBe(15)
    expect(result.newHp).toBe(25)
  })
})
