import type { BuffSnapshot } from '@/types/buff-v3'
import { describe, expect, it } from 'vitest'
import {
  buildDefinition,
  definitionToForm,
  deriveLifecycle,
  EMPTY_BUFF_FORM,
  instanceToForm,
  normalizeBuffForm,
} from './form-helpers'

describe('normalizeBuffForm', () => {
  it('throws when name is empty', () => {
    expect(() => normalizeBuffForm({ ...EMPTY_BUFF_FORM, name: '   ' }))
      .toThrow('名字不能为空')
  })

  it('throws when description is empty', () => {
    expect(() => normalizeBuffForm({ ...EMPTY_BUFF_FORM, name: 'X', description: '' }))
      .toThrow('描述不能为空')
  })

  it('trims name and description', () => {
    const n = normalizeBuffForm({
      ...EMPTY_BUFF_FORM,
      name: '  X  ',
      description: '  Y  ',
    })
    expect(n.name).toBe('X')
    expect(n.description).toBe('Y')
  })

  it('falls back icon to i-mdi-star when blank', () => {
    const n = normalizeBuffForm({
      ...EMPTY_BUFF_FORM,
      name: 'X',
      description: 'Y',
      icon: '   ',
    })
    expect(n.icon).toBe('i-mdi-star')
  })

  it('keeps custom icon as-is (trimmed)', () => {
    const n = normalizeBuffForm({
      ...EMPTY_BUFF_FORM,
      name: 'X',
      description: 'Y',
      icon: '  i-mdi-fire  ',
    })
    expect(n.icon).toBe('i-mdi-fire')
  })

  it('coerces empty turnsRemaining to undefined', () => {
    const n = normalizeBuffForm({
      ...EMPTY_BUFF_FORM,
      name: 'X',
      description: 'Y',
      turnsRemaining: '',
    })
    expect(n.turnsRemaining).toBeUndefined()
  })

  it('keeps numeric turnsRemaining', () => {
    const n = normalizeBuffForm({
      ...EMPTY_BUFF_FORM,
      name: 'X',
      description: 'Y',
      turnsRemaining: 3,
    })
    expect(n.turnsRemaining).toBe(3)
  })

  it('passes polarity through', () => {
    const n = normalizeBuffForm({
      ...EMPTY_BUFF_FORM,
      name: 'X',
      description: 'Y',
      polarity: 'negative',
    })
    expect(n.polarity).toBe('negative')
  })
})

describe('deriveLifecycle', () => {
  it('returns persistent when undefined', () => {
    expect(deriveLifecycle(undefined)).toBe('persistent')
  })

  it('returns encounter when 0 (0 is a value)', () => {
    expect(deriveLifecycle(0)).toBe('encounter')
  })

  it('returns encounter when positive number', () => {
    expect(deriveLifecycle(5)).toBe('encounter')
  })
})

describe('buildDefinition', () => {
  const n = {
    name: 'X',
    description: 'Y',
    icon: 'i-mdi-star',
    polarity: 'positive' as const,
    turnsRemaining: 3,
  }

  it('maps turnsRemaining to defaultDuration', () => {
    const def = buildDefinition('custom.abc', n)
    expect(def.defaultDuration).toBe(3)
  })

  it('maps undefined turnsRemaining to undefined defaultDuration', () => {
    const def = buildDefinition('custom.abc', { ...n, turnsRemaining: undefined })
    expect(def.defaultDuration).toBeUndefined()
  })

  it('writes scope=single, builtin=false, modifiers=[]', () => {
    const def = buildDefinition('custom.abc', n)
    expect(def.scope).toBe('single')
    expect(def.builtin).toBe(false)
    expect(def.modifiers).toEqual([])
  })

  it('does not write color/tickPrompt/reminder/defaultAoeRadius', () => {
    const def = buildDefinition('custom.abc', n) as unknown as Record<string, unknown>
    expect(def.color).toBeUndefined()
    expect(def.tickPrompt).toBeUndefined()
    expect(def.reminder).toBeUndefined()
    expect(def.defaultAoeRadius).toBeUndefined()
  })

  it('respects given id', () => {
    expect(buildDefinition('custom.xyz', n).id).toBe('custom.xyz')
    expect(buildDefinition('ephemeral.qqq', n).id).toBe('ephemeral.qqq')
  })
})

describe('definitionToForm round-trips with buildDefinition', () => {
  it('preserves core fields', () => {
    const n = {
      name: 'X',
      description: 'Y',
      icon: 'i-mdi-fire',
      polarity: 'negative' as const,
      turnsRemaining: 5,
    }
    const def = buildDefinition('custom.abc', n)
    const form = definitionToForm(def)
    expect(form.name).toBe('X')
    expect(form.description).toBe('Y')
    expect(form.icon).toBe('i-mdi-fire')
    expect(form.polarity).toBe('negative')
    expect(form.turnsRemaining).toBe(5)
  })

  it('maps undefined defaultDuration to empty string', () => {
    const n = {
      name: 'X',
      description: 'Y',
      icon: 'i-mdi-star',
      polarity: 'positive' as const,
      turnsRemaining: undefined,
    }
    const def = buildDefinition('custom.abc', n)
    const form = definitionToForm(def)
    expect(form.turnsRemaining).toBe('')
  })
})

describe('instanceToForm', () => {
  function snap(): BuffSnapshot {
    return {
      name: 'X',
      icon: 'i-mdi-fire',
      description: 'Y',
      modifiers: [],
      polarity: 'negative',
    }
  }

  it('reads from snapshot + turnsRemaining param', () => {
    const form = instanceToForm(snap(), 2)
    expect(form.name).toBe('X')
    expect(form.icon).toBe('i-mdi-fire')
    expect(form.description).toBe('Y')
    expect(form.polarity).toBe('negative')
    expect(form.turnsRemaining).toBe(2)
  })

  it('maps undefined turnsRemaining to empty string', () => {
    const form = instanceToForm(snap(), undefined)
    expect(form.turnsRemaining).toBe('')
  })
})

describe('EMPTY_BUFF_FORM', () => {
  it('has positive default polarity and empty fields', () => {
    expect(EMPTY_BUFF_FORM).toEqual({
      name: '',
      description: '',
      turnsRemaining: '',
      polarity: 'positive',
      icon: '',
    })
  })
})
