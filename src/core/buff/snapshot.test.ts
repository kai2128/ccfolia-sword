import type { StatusEffectDefinition } from '@/types/buff-v3'
import { describe, expect, it } from 'vitest'
import { createSnapshot } from './snapshot'

function sampleDefinition(): StatusEffectDefinition {
  return {
    id: 'builtin.poison',
    name: '中毒',
    icon: 'i-mdi-biohazard',
    color: '#0a0',
    description: '每回合末受伤',
    defaultDuration: 3,
    scope: 'single',
    defaultAoeRadius: 2,
    tickPrompt: '掷 1d6',
    modifiers: [{ target: 'defense', value: -1 }],
    reminder: '中毒提醒',
    builtin: true,
    polarity: 'positive',
  }
}

describe('createSnapshot', () => {
  it('copies runtime fields from definition', () => {
    const snapshot = createSnapshot(sampleDefinition())
    expect(snapshot.name).toBe('中毒')
    expect(snapshot.icon).toBe('i-mdi-biohazard')
    expect(snapshot.color).toBe('#0a0')
    expect(snapshot.description).toBe('每回合末受伤')
    expect(snapshot.tickPrompt).toBe('掷 1d6')
    expect(snapshot.reminder).toBe('中毒提醒')
    expect(snapshot.defaultAoeRadius).toBe(2)
    expect(snapshot.modifiers).toEqual([{ target: 'defense', value: -1 }])
  })

  it('does not include definition-only fields', () => {
    const snapshot = createSnapshot(sampleDefinition()) as unknown as Record<string, unknown>
    expect(snapshot.id).toBeUndefined()
    expect(snapshot.scope).toBeUndefined()
    expect(snapshot.defaultDuration).toBeUndefined()
    expect(snapshot.builtin).toBeUndefined()
  })

  it('deep-copies modifiers', () => {
    const definition = sampleDefinition()
    const snapshot = createSnapshot(definition)
    definition.modifiers[0].value = 99
    expect(snapshot.modifiers[0].value).toBe(-1)
  })
})
