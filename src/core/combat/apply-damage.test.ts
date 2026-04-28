import type { ActionDraft, ActionTarget } from '@/types/action'
import type { CcfoliaStatus } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'
import { InvalidDraftError } from '@/types/action'
import { applyDamageToTarget, validateDraft } from './apply-damage'

const goblin: CcfoliaStatus[] = [
  { label: 'HP', value: 10, max: 10 },
  { label: '防御', value: 3, max: 3 },
]

function draft(partial: Partial<ActionDraft>): ActionDraft {
  return {
    id: 'a1',
    kind: 'damage',
    damageType: 'physical',
    rawValue: 10,
    resistType: 'none',
    targets: [],
    ...partial,
  }
}

describe('applyDamageToTarget · physical', () => {
  it('subtracts defense', () => {
    const action = draft({ rawValue: 10, resistType: 'none' })
    const target: ActionTarget = { characterId: 'g1' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(7)
    expect(result.newHp).toBe(3)
  })

  it('allows HP below 0', () => {
    const action = draft({ rawValue: 100 })
    const target: ActionTarget = { characterId: 'g1' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(97)
    expect(result.newHp).toBe(-87)
  })

  it('damage never below 0', () => {
    const action = draft({ rawValue: 1 })
    const target: ActionTarget = { characterId: 'g1' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(0)
    expect(result.newHp).toBe(10)
  })
})

describe('applyDamageToTarget · magical', () => {
  it('does not subtract defense', () => {
    const action = draft({ damageType: 'magical', rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(10)
    expect(result.newHp).toBe(0)
  })
})

describe('applyDamageToTarget · resist', () => {
  it('halves raw value on success', () => {
    const action = draft({ rawValue: 11, resistType: 'mental', damageType: 'magical' })
    const target: ActionTarget = { characterId: 'g1', resistResult: 'success', resistOutcome: 'half' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(5)
  })

  it('nullifies on success + nullify', () => {
    const action = draft({ rawValue: 11, resistType: 'mental', damageType: 'magical' })
    const target: ActionTarget = { characterId: 'g1', resistResult: 'success', resistOutcome: 'nullify' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(0)
  })

  it('keeps full raw value on failure', () => {
    const action = draft({ rawValue: 10, resistType: 'mental', damageType: 'magical' })
    const target: ActionTarget = { characterId: 'g1', resistResult: 'failure' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(10)
  })

  it('defaults resistOutcome to half', () => {
    const action = draft({ rawValue: 11, resistType: 'mental', damageType: 'magical' })
    const target: ActionTarget = { characterId: 'g1', resistResult: 'success' }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(5)
  })
})

describe('finalValueOverride', () => {
  it('replaces computed final value', () => {
    const action = draft({ rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1', finalValueOverride: 99 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(99)
    expect(result.newHp).toBe(-89)
  })

  it('ignores bonus/penalty when override is set', () => {
    const action = draft({ rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1', finalValueOverride: 50, bonus: 5, penalty: 3 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    expect(result.finalDamage).toBe(50)
  })
})

describe('bonus / penalty', () => {
  it('adds bonus after defense', () => {
    const action = draft({ rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1', bonus: 4 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    // 10 - 3 (defense) + 4 = 11
    expect(result.finalDamage).toBe(11)
  })

  it('subtracts penalty after defense', () => {
    const action = draft({ rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1', penalty: 2 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    // 10 - 3 - 2 = 5
    expect(result.finalDamage).toBe(5)
  })

  it('combines bonus and penalty', () => {
    const action = draft({ rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1', bonus: 5, penalty: 2 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    // 10 - 3 + 5 - 2 = 10
    expect(result.finalDamage).toBe(10)
  })

  it('clamps to 0 when penalty exceeds computed', () => {
    const action = draft({ rawValue: 5 })
    const target: ActionTarget = { characterId: 'g1', penalty: 10 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    // max(0, 5 - 3 - 10) = 0
    expect(result.finalDamage).toBe(0)
  })

  it('applies on magical (no defense subtract)', () => {
    const action = draft({ damageType: 'magical', rawValue: 10 })
    const target: ActionTarget = { characterId: 'g1', bonus: 3, penalty: 1 }
    const result = applyDamageToTarget(action, target, { status: goblin, mods: [], currentHp: 10 }, DEFAULT_STATUS_LABEL_MAP)
    // 10 + 3 - 1 = 12
    expect(result.finalDamage).toBe(12)
  })
})

describe('validateDraft', () => {
  it('throws when resistResult is missing', () => {
    const action = draft({
      resistType: 'mental',
      damageType: 'magical',
      targets: [{ characterId: 'g1' }],
    })
    expect(() => validateDraft(action)).toThrow(InvalidDraftError)
  })

  it('passes when resistType is none', () => {
    const action = draft({ resistType: 'none', targets: [{ characterId: 'g1' }] })
    expect(() => validateDraft(action)).not.toThrow()
  })

  it('passes when every target has resistResult', () => {
    const action = draft({
      resistType: 'mental',
      damageType: 'magical',
      targets: [{ characterId: 'g1', resistResult: 'failure' }],
    })
    expect(() => validateDraft(action)).not.toThrow()
  })

  it('throws when damage draft lacks damageType', () => {
    const action = draft({ damageType: undefined })
    expect(() => validateDraft(action)).toThrow(InvalidDraftError)
  })

  it('throws on negative rawValue', () => {
    const action = draft({ rawValue: -5, targets: [{ characterId: 'g1' }] })
    expect(() => validateDraft(action)).toThrow(InvalidDraftError)
  })

  it('throws on negative mpCost', () => {
    const action = draft({ mpCost: -3, targets: [{ characterId: 'g1' }] })
    expect(() => validateDraft(action)).toThrow(InvalidDraftError)
  })

  it('allows 0 rawValue and 0 mpCost', () => {
    const action = draft({ rawValue: 0, mpCost: 0, targets: [{ characterId: 'g1' }] })
    expect(() => validateDraft(action)).not.toThrow()
  })

  it('throws on non-integer rawValue and mpCost', () => {
    const actionA = draft({ rawValue: 1.5, targets: [{ characterId: 'g1' }] })
    expect(() => validateDraft(actionA)).toThrow(InvalidDraftError)

    const actionB = draft({ mpCost: 0.5, targets: [{ characterId: 'g1' }] })
    expect(() => validateDraft(actionB)).toThrow(InvalidDraftError)
  })

  it('throws on negative bonus / penalty', () => {
    const actionA = draft({ targets: [{ characterId: 'g1', bonus: -1 }] })
    expect(() => validateDraft(actionA)).toThrow(InvalidDraftError)

    const actionB = draft({ targets: [{ characterId: 'g1', penalty: -2 }] })
    expect(() => validateDraft(actionB)).toThrow(InvalidDraftError)
  })

  it('throws on non-integer bonus / penalty', () => {
    const action = draft({ targets: [{ characterId: 'g1', bonus: 1.5 }] })
    expect(() => validateDraft(action)).toThrow(InvalidDraftError)
  })

  it('allows 0 bonus and 0 penalty', () => {
    const action = draft({ targets: [{ characterId: 'g1', bonus: 0, penalty: 0 }] })
    expect(() => validateDraft(action)).not.toThrow()
  })
})
