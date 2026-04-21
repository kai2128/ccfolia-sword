import type { ModifierContribution } from './resolve-modifiers'
import type { CcfoliaStatus } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'
import { resolveDefense, sumModifiers } from './resolve-modifiers'

const status: CcfoliaStatus[] = [
  { label: 'HP', value: 22, max: 25 },
  { label: '防御', value: 5, max: 5 },
]

describe('resolveDefense', () => {
  it('returns base defense when no modifiers', () => {
    expect(resolveDefense(status, DEFAULT_STATUS_LABEL_MAP, [])).toBe(5)
  })

  it('adds positive modifier', () => {
    const mods: ModifierContribution[] = [{ target: 'defense', value: 2 }]
    expect(resolveDefense(status, DEFAULT_STATUS_LABEL_MAP, mods)).toBe(7)
  })

  it('subtracts negative modifier', () => {
    const mods: ModifierContribution[] = [{ target: 'defense', value: -3 }]
    expect(resolveDefense(status, DEFAULT_STATUS_LABEL_MAP, mods)).toBe(2)
  })

  it('ignores modifiers targeting other fields', () => {
    const mods: ModifierContribution[] = [
      { target: 'attack', value: 99 },
      { target: 'damage', value: 99 },
    ]
    expect(resolveDefense(status, DEFAULT_STATUS_LABEL_MAP, mods)).toBe(5)
  })

  it('returns 0 when no 防御 slot', () => {
    expect(resolveDefense([], DEFAULT_STATUS_LABEL_MAP, [])).toBe(0)
  })
})

describe('sumModifiers', () => {
  it('sums matching target', () => {
    const mods: ModifierContribution[] = [
      { target: 'defense', value: 2 },
      { target: 'defense', value: -1 },
      { target: 'attack', value: 5 },
    ]
    expect(sumModifiers(mods, 'defense')).toBe(1)
  })

  it('returns 0 for empty', () => {
    expect(sumModifiers([], 'defense')).toBe(0)
  })
})
