import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { encodeBuff } from './codec'
import { collectBuffs } from './collect'

function makeBuff(id: string): BuffInstance {
  return {
    id,
    definitionId: 'builtin.poison',
    snapshot: { name: 'x', icon: '', description: '', modifiers: [], polarity: 'positive' },
    attachedTo: { kind: 'single', characterId: 'c1' },
    lifecycle: 'encounter',
    enabled: true,
    attachedAtTurn: 1,
  }
}

function makeCharacter(params: Array<{ label: string, value: string }>): CcfoliaCharacter {
  return {
    _id: 'c1',
    roomId: 'room',
    name: 'test',
    status: [],
    params,
  } as CcfoliaCharacter
}

describe('collectBuffs', () => {
  it('returns empty when character has no params', () => {
    expect(collectBuffs(makeCharacter([]))).toEqual([])
  })

  it('returns empty when no cs_buff_ entries', () => {
    expect(collectBuffs(makeCharacter([{ label: 'cs_part_leg', value: 'ok' }]))).toEqual([])
  })

  it('parses cs_buff_ entries into instances', () => {
    const first = makeBuff('a')
    const second = makeBuff('b')
    const buffs = collectBuffs(makeCharacter([
      { label: 'cs_part_leg', value: 'ok' },
      { label: 'cs_buff_a', value: encodeBuff(first) },
      { label: 'cs_buff_b', value: encodeBuff(second) },
    ]))
    expect(buffs).toHaveLength(2)
    expect(buffs.map(buff => buff.id).sort()).toEqual(['a', 'b'])
  })

  it('skips corrupted cs_buff_ entries', () => {
    const good = makeBuff('good')
    const buffs = collectBuffs(makeCharacter([
      { label: 'cs_buff_good', value: encodeBuff(good) },
      { label: 'cs_buff_bad', value: '{not valid' },
    ]))
    expect(buffs).toHaveLength(1)
    expect(buffs[0].id).toBe('good')
  })
})
