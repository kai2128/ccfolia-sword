import type { ModifierContribution } from './resolve-modifiers'
import type { BuffInstance, ModifierDefinition } from '@/types/buff-v3'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { encodeBuff } from '@/core/buff/codec'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'
import { collectDefenseMods, resolveDefense, sumModifiers } from './resolve-modifiers'

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

function makeBuff(modifiers: ModifierDefinition[], enabled = true): BuffInstance {
  return {
    id: 'b',
    definitionId: 'x',
    snapshot: { name: '', icon: '', description: '', modifiers, polarity: 'positive' },
    attachedTo: { kind: 'single', characterId: 'c' },
    lifecycle: 'encounter',
    enabled,
    attachedAtTurn: 1,
  }
}

function makeCharacter(defense: number, buffs: BuffInstance[]): CcfoliaCharacter {
  return {
    _id: 'c',
    roomId: 'room',
    name: 'test',
    active: true,
    status: [{ label: '防御', value: defense, max: defense }],
    params: buffs.map(buff => ({ label: `cs_buff_${buff.id}`, value: encodeBuff(buff) })),
  } as CcfoliaCharacter
}

describe('collectDefenseMods', () => {
  it('skips disabled buffs', () => {
    const buff = makeBuff([{ target: 'defense', value: 5 }], false)
    expect(collectDefenseMods(makeCharacter(3, [buff]))).toEqual([])
  })

  it('collects from multiple enabled buffs', () => {
    const first = { ...makeBuff([{ target: 'defense', value: 2 }]), id: 'b1' }
    const second = { ...makeBuff([{ target: 'defense', value: 1 }]), id: 'b2' }
    const mods = collectDefenseMods(makeCharacter(3, [first, second]))
    expect(mods.map(modifier => modifier.value).reduce((sum, value) => sum + value, 0)).toBe(3)
  })

  it('filters modifiers with different target', () => {
    const buff = makeBuff([
      { target: 'attack', value: 5 },
      { target: 'defense', value: 2 },
    ])
    expect(collectDefenseMods(makeCharacter(3, [buff]))).toEqual([{ target: 'defense', value: 2 }])
  })

  it('integrates with resolveDefense', () => {
    const buff = makeBuff([{ target: 'defense', value: 4 }])
    const character = makeCharacter(3, [buff])
    const mods = collectDefenseMods(character)
    expect(resolveDefense(character.status, DEFAULT_STATUS_LABEL_MAP, mods)).toBe(7)
  })
})
