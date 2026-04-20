import { describe, expect, it } from 'vitest'
import { makeDragon, makeGoblin, makePc } from '@/core/__fixtures__/characters'
import { validateStoredCharacter } from './validate'

describe('validateStoredCharacter', () => {
  it('accepts single-part PC', () => {
    expect(validateStoredCharacter(makePc())).toEqual({ ok: true })
  })

  it('accepts single-part enemy', () => {
    expect(validateStoredCharacter(makeGoblin())).toEqual({ ok: true })
  })

  it('accepts multi-part boss', () => {
    expect(validateStoredCharacter(makeDragon())).toEqual({ ok: true })
  })

  it('rejects null', () => {
    const r = validateStoredCharacter(null)
    expect(r.ok).toBe(false)
  })

  it('rejects missing id', () => {
    const bad = { ...makePc(), id: undefined as unknown as string }
    const r = validateStoredCharacter(bad)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.field).toBe('id')
  })

  it('rejects invalid faction', () => {
    const bad = { ...makePc(), faction: 'hostile' as unknown as 'enemy' }
    const r = validateStoredCharacter(bad)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.field).toBe('faction')
  })

  it('rejects invalid control', () => {
    const bad = { ...makePc(), control: 'npc' as unknown as 'gm' }
    const r = validateStoredCharacter(bad)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.field).toBe('control')
  })

  it('rejects non-numeric hp.max', () => {
    const bad = { ...makePc(), hp: { current: 10, max: 'ten' as unknown as number } }
    const r = validateStoredCharacter(bad)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.field).toContain('hp')
  })

  it('rejects empty parts array', () => {
    const bad = { ...makeDragon(), parts: [] }
    const r = validateStoredCharacter(bad)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.field).toBe('parts')
  })

  it('rejects part missing hp', () => {
    const dragon = makeDragon()
    const parts = dragon.parts
    if (!parts || parts.length === 0)
      throw new Error('dragon must have parts')
    const badPart = { ...parts[0] } as Partial<typeof parts[0]>
    delete badPart.hp
    const bad = { ...dragon, parts: [badPart as typeof parts[0], ...parts.slice(1)] }
    const r = validateStoredCharacter(bad)
    expect(r.ok).toBe(false)
    if (!r.ok)
      expect(r.field).toContain('parts[0].hp')
  })
})
