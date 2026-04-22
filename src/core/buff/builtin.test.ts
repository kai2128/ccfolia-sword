import { describe, expect, it } from 'vitest'
import { BUILTIN_STATUS_EFFECTS } from './builtin'

describe('bUILTIN_STATUS_EFFECTS', () => {
  it('contains 14 entries', () => {
    expect(BUILTIN_STATUS_EFFECTS).toHaveLength(14)
  })

  it('has unique ids', () => {
    const ids = BUILTIN_STATUS_EFFECTS.map(definition => definition.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has valid scope', () => {
    for (const definition of BUILTIN_STATUS_EFFECTS)
      expect(['single', 'aoe']).toContain(definition.scope)
  })

  it('every entry is marked builtin', () => {
    for (const definition of BUILTIN_STATUS_EFFECTS)
      expect(definition.builtin).toBe(true)
  })

  it('every id starts with builtin.', () => {
    for (const definition of BUILTIN_STATUS_EFFECTS)
      expect(definition.id.startsWith('builtin.')).toBe(true)
  })
})
