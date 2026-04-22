import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { decodeBuff, encodeBuff } from '@/core/buff/codec'
import { applyBuffTickToParams } from './tick-buff-turns'

function buff(id: string, turnsRemaining: number | undefined): BuffInstance {
  return {
    id,
    definitionId: 'd',
    snapshot: {
      name: id,
      icon: '',
      description: '',
      modifiers: [],
      polarity: 'positive',
    },
    attachedTo: { kind: 'single', characterId: 'c1' },
    lifecycle: turnsRemaining !== undefined ? 'encounter' : 'persistent',
    enabled: true,
    turnsRemaining,
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
    const next = applyBuffTickToParams(pack([buff('a', 3)]))
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_a')!.value)!
    expect(updated.turnsRemaining).toBe(2)
  })

  it('removes buff when turnsRemaining hits 0 (was 1)', () => {
    const next = applyBuffTickToParams(pack([buff('a', 1)]))
    expect(next.find(p => p.label === 'cs_buff_a')).toBeUndefined()
  })

  it('removes buff already at 0', () => {
    const next = applyBuffTickToParams(pack([buff('a', 0)]))
    expect(next.find(p => p.label === 'cs_buff_a')).toBeUndefined()
  })

  it('does not touch buff with undefined turnsRemaining (manual)', () => {
    const original = pack([buff('a', undefined)])
    const next = applyBuffTickToParams(original)
    expect(next).toBe(original)
  })

  it('returns same reference when nothing changed', () => {
    const original = pack([buff('a', undefined), buff('b', undefined)])
    expect(applyBuffTickToParams(original)).toBe(original)
  })

  it('keeps non-buff params untouched and in original positions', () => {
    const next = applyBuffTickToParams(pack([buff('a', 3)]))
    expect(next[0]).toEqual({ label: 'hp', value: '10' })
    expect(next[next.length - 1]).toEqual({ label: 'mp', value: '5' })
  })

  it('handles a mix: tick one, remove one, leave one', () => {
    const next = applyBuffTickToParams(pack([
      buff('keep', undefined),
      buff('tick', 3),
      buff('expire', 1),
    ]))
    expect(next.find(p => p.label === 'cs_buff_keep')).toBeDefined()
    expect(decodeBuff(next.find(p => p.label === 'cs_buff_tick')!.value)!.turnsRemaining).toBe(2)
    expect(next.find(p => p.label === 'cs_buff_expire')).toBeUndefined()
  })

  it('skips buff entries that fail to decode', () => {
    const original: CcfoliaParam[] = [
      { label: 'hp', value: '10' },
      { label: 'cs_buff_bad', value: 'not-json' },
    ]
    expect(applyBuffTickToParams(original)).toBe(original)
  })
})
