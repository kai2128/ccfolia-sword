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

  it('adds bonus and subtracts penalty', () => {
    const result = applyHealToTarget(draft({ rawValue: 5 }), { characterId: 'c1', bonus: 4, penalty: 1 }, { currentHp: 10, maxHp: 25 })
    // 5 + 4 - 1 = 8
    expect(result.healedAmount).toBe(8)
    expect(result.newHp).toBe(18)
  })

  it('clamps raw to 0 when penalty exceeds raw + bonus', () => {
    const result = applyHealToTarget(draft({ rawValue: 3 }), { characterId: 'c1', penalty: 10 }, { currentHp: 10, maxHp: 25 })
    expect(result.healedAmount).toBe(0)
    expect(result.newHp).toBe(10)
  })

  it('still respects maxHp with bonus', () => {
    const result = applyHealToTarget(draft({ rawValue: 5 }), { characterId: 'c1', bonus: 100 }, { currentHp: 22, maxHp: 25 })
    expect(result.healedAmount).toBe(3)
    expect(result.newHp).toBe(25)
  })

  it('ignores bonus/penalty when override is set', () => {
    const result = applyHealToTarget(
      draft({ rawValue: 5 }),
      { characterId: 'c1', finalValueOverride: 7, bonus: 100, penalty: 50 },
      { currentHp: 10, maxHp: 25 },
    )
    expect(result.healedAmount).toBe(7)
    expect(result.newHp).toBe(17)
  })
})
