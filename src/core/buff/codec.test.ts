import type { BuffInstance } from '@/types/buff-v3'
import { describe, expect, it } from 'vitest'
import { BUFF_LABEL_PREFIX, buffLabel, decodeBuff, encodeBuff, isBuffLabel } from './codec'

function sampleBuff(): BuffInstance {
  return {
    id: 'abc-123',
    definitionId: 'builtin.poison',
    snapshot: {
      name: '中毒',
      icon: 'i-mdi-biohazard',
      description: '',
      modifiers: [{ target: 'defense', value: -1 }],
      polarity: 'positive',
    },
    attachedTo: { kind: 'single', characterId: 'char-1' },
    lifecycle: 'encounter',
    enabled: true,
    turnsRemaining: 3,
    attachedAtTurn: 1,
  }
}

describe('buff codec', () => {
  it('encode then decode round-trips', () => {
    const raw = encodeBuff(sampleBuff())
    expect(decodeBuff(raw)).toEqual(sampleBuff())
  })

  it('decode returns null for non-json', () => {
    expect(decodeBuff('not-json')).toBeNull()
  })

  it('decode returns null for missing id', () => {
    expect(decodeBuff(JSON.stringify({ definitionId: 'x' }))).toBeNull()
  })

  it('decode returns null for missing snapshot', () => {
    expect(decodeBuff(JSON.stringify({
      id: 'a',
      definitionId: 'x',
      attachedTo: { kind: 'single', characterId: 'c' },
      lifecycle: 'encounter',
      enabled: true,
      attachedAtTurn: 1,
    }))).toBeNull()
  })

  it('buffLabel prefixes with cs_buff_', () => {
    expect(buffLabel('abc-123')).toBe('cs_buff_abc-123')
  })

  it('isBuffLabel checks prefix', () => {
    expect(isBuffLabel('cs_buff_abc')).toBe(true)
    expect(isBuffLabel('cs_part_1')).toBe(false)
    expect(isBuffLabel('HP')).toBe(false)
  })

  it('prefix constant matches', () => {
    expect(BUFF_LABEL_PREFIX).toBe('cs_buff_')
  })
})

describe('decodeBuff polarity tolerance', () => {
  function buildRaw(overrides: Record<string, unknown> = {}): string {
    const base = {
      id: 'abc',
      definitionId: 'x',
      snapshot: {
        name: 'n',
        icon: '',
        description: '',
        modifiers: [],
        polarity: 'negative',
        ...overrides,
      },
      attachedTo: { kind: 'single', characterId: 'c' },
      lifecycle: 'encounter',
      enabled: true,
      attachedAtTurn: 1,
    }
    return JSON.stringify(base)
  }

  it('keeps valid negative polarity', () => {
    const buff = decodeBuff(buildRaw())
    expect(buff?.snapshot.polarity).toBe('negative')
  })

  it('defaults missing polarity to positive', () => {
    const raw = JSON.stringify({
      id: 'abc',
      definitionId: 'x',
      snapshot: { name: 'n', icon: '', description: '', modifiers: [] },
      attachedTo: { kind: 'single', characterId: 'c' },
      lifecycle: 'encounter',
      enabled: true,
      attachedAtTurn: 1,
    })
    const buff = decodeBuff(raw)
    expect(buff?.snapshot.polarity).toBe('positive')
  })

  it('defaults invalid polarity to positive', () => {
    const raw = JSON.stringify({
      id: 'abc',
      definitionId: 'x',
      snapshot: { name: 'n', icon: '', description: '', modifiers: [], polarity: 'weird' },
      attachedTo: { kind: 'single', characterId: 'c' },
      lifecycle: 'encounter',
      enabled: true,
      attachedAtTurn: 1,
    })
    const buff = decodeBuff(raw)
    expect(buff?.snapshot.polarity).toBe('positive')
  })
})
