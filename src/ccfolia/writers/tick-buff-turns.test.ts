import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { decodeBuff, encodeBuff } from '@/core/buff/codec'
import { applyBuffTickToParams } from './tick-buff-turns'

interface BuffOverrides {
  id: string
  turnsRemaining?: number
  enabled?: boolean
  name?: string
  tickPrompt?: string
}

function buff(opts: BuffOverrides | string, turnsRemaining?: number): BuffInstance {
  const o: BuffOverrides = typeof opts === 'string'
    ? { id: opts, turnsRemaining }
    : opts
  return {
    id: o.id,
    definitionId: 'd',
    snapshot: {
      name: o.name ?? o.id,
      icon: '',
      description: '',
      modifiers: [],
      polarity: 'positive',
      ...(o.tickPrompt !== undefined ? { tickPrompt: o.tickPrompt } : {}),
    },
    attachedTo: { kind: 'single', characterId: 'c1' },
    lifecycle: o.turnsRemaining !== undefined ? 'encounter' : 'persistent',
    enabled: o.enabled ?? true,
    turnsRemaining: o.turnsRemaining,
    attachedAtTurn: 1,
  }
}

function pack(buffs: BuffInstance[]): CcfoliaParam[] {
  return [
    { label: 'hp', value: '10' },
    ...buffs.map(b => ({ label: `cs_buff_${b.id}`, value: encodeBuff(b) })),
    { label: 'mp', value: '5' },
  ]
}

describe('applyBuffTickToParams', () => {
  it('decrements turnsRemaining by 1', () => {
    const { next } = applyBuffTickToParams(pack([buff('a', 3)]), 'c')
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_a')!.value)!
    expect(updated.turnsRemaining).toBe(2)
  })

  it('removes buff when turnsRemaining hits 0 (was 1)', () => {
    const { next } = applyBuffTickToParams(pack([buff('a', 1)]), 'c')
    expect(next.find(p => p.label === 'cs_buff_a')).toBeUndefined()
  })

  it('removes buff already at 0', () => {
    const { next } = applyBuffTickToParams(pack([buff('a', 0)]), 'c')
    expect(next.find(p => p.label === 'cs_buff_a')).toBeUndefined()
  })

  it('does not touch buff with undefined turnsRemaining (manual)', () => {
    const original = pack([buff('a', undefined)])
    const { next } = applyBuffTickToParams(original, 'c')
    expect(next).toBe(original)
  })

  it('returns same reference when nothing changed', () => {
    const original = pack([buff('a', undefined), buff('b', undefined)])
    expect(applyBuffTickToParams(original, 'c').next).toBe(original)
  })

  it('keeps non-buff params untouched and in original positions', () => {
    const { next } = applyBuffTickToParams(pack([buff('a', 3)]), 'c')
    expect(next[0]).toEqual({ label: 'hp', value: '10' })
    expect(next[next.length - 1]).toEqual({ label: 'mp', value: '5' })
  })

  it('handles a mix: tick one, remove one, leave one', () => {
    const { next } = applyBuffTickToParams(pack([
      buff('keep', undefined),
      buff('tick', 3),
      buff('expire', 1),
    ]), 'c')
    expect(next.find(p => p.label === 'cs_buff_keep')).toBeDefined()
    expect(decodeBuff(next.find(p => p.label === 'cs_buff_tick')!.value)!.turnsRemaining).toBe(2)
    expect(next.find(p => p.label === 'cs_buff_expire')).toBeUndefined()
  })

  it('skips buff entries that fail to decode', () => {
    const original: CcfoliaParam[] = [
      { label: 'hp', value: '10' },
      { label: 'cs_buff_bad', value: 'not-json' },
    ]
    expect(applyBuffTickToParams(original, 'c').next).toBe(original)
  })
})

describe('applyBuffTickToParams · prompts', () => {
  it('collects prompt only for enabled buffs with non-empty tickPrompt', () => {
    const params = pack([
      buff({ id: 'p1', enabled: true, name: '中毒', tickPrompt: '掷 1d6', turnsRemaining: 3 }),
      buff({ id: 'p2', enabled: false, name: '燃烧', tickPrompt: '掷 1d4', turnsRemaining: 3 }),
      buff({ id: 'p3', enabled: true, name: '祝福', turnsRemaining: 3 }),
    ])
    const { prompts } = applyBuffTickToParams(params, 'char-x')
    expect(prompts.map(p => p.buffId)).toEqual(['p1'])
    expect(prompts[0]).toEqual({
      characterId: 'char-x',
      buffId: 'p1',
      buffName: '中毒',
      prompt: '掷 1d6',
    })
  })

  it('collects prompt before tick (last-tick still gets prompt)', () => {
    const params = pack([
      buff({ id: 'p1', enabled: true, name: '中毒', tickPrompt: '掷 1d6', turnsRemaining: 1 }),
    ])
    const { next, prompts } = applyBuffTickToParams(params, 'c')
    expect(prompts).toHaveLength(1)
    expect(next.find(p => p.label === 'cs_buff_p1')).toBeUndefined()
  })

  it('disabled buff still ticks turnsRemaining but no prompt', () => {
    const params = pack([
      buff({ id: 'p1', enabled: false, name: '燃烧', tickPrompt: '掷 1d4', turnsRemaining: 3 }),
    ])
    const { next, prompts } = applyBuffTickToParams(params, 'c')
    expect(prompts).toHaveLength(0)
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_p1')!.value)!
    expect(updated.turnsRemaining).toBe(2)
  })
})
