import { describe, expect, it } from 'vitest'
import { clampHp, clampMp, parseAdjustment, resolveNewValue } from './adjust-hp-mp'

describe('clampHp', () => {
  it('passes through positive values', () => {
    expect(clampHp(15, 25)).toBe(15)
  })

  it('allows exceeding max (过量治疗/临时增益)', () => {
    expect(clampHp(30, 25)).toBe(30)
  })

  it('clamps to max when clampMax=true', () => {
    expect(clampHp(30, 25, true)).toBe(25)
  })

  it('allows negative values (HP 可 -1)', () => {
    expect(clampHp(-5, 25)).toBe(-5)
    expect(clampHp(-100, 25)).toBe(-100)
  })
})

describe('clampMp', () => {
  it('clamps at 0', () => {
    expect(clampMp(-5, 12)).toBe(0)
  })

  it('allows exceeding max', () => {
    expect(clampMp(20, 12)).toBe(20)
  })

  it('clamps to max when clampMax=true', () => {
    expect(clampMp(20, 12, true)).toBe(12)
  })

  it('passes through valid', () => {
    expect(clampMp(8, 12)).toBe(8)
  })
})

describe('parseAdjustment', () => {
  it('parses absolute number', () => {
    expect(parseAdjustment('17')).toEqual({ kind: 'absolute', value: 17 })
  })

  it('parses +N as delta', () => {
    expect(parseAdjustment('+5')).toEqual({ kind: 'delta', value: 5 })
  })

  it('parses -N as delta', () => {
    expect(parseAdjustment('-3')).toEqual({ kind: 'delta', value: -3 })
  })

  it('allows negative absolute via tag', () => {
    expect(parseAdjustment('=-5')).toEqual({ kind: 'absolute', value: -5 })
  })

  it('trims whitespace', () => {
    expect(parseAdjustment('  +5  ')).toEqual({ kind: 'delta', value: 5 })
  })

  it('returns null on empty / garbage', () => {
    expect(parseAdjustment('')).toBeNull()
    expect(parseAdjustment('abc')).toBeNull()
    expect(parseAdjustment('+')).toBeNull()
    expect(parseAdjustment('1.5.3')).toBeNull()
  })
})

describe('resolveNewValue', () => {
  const curr = 10
  const max = 25

  it('absolute for hp (allows negative result)', () => {
    expect(resolveNewValue({ kind: 'absolute', value: -3 }, curr, max, 'hp')).toBe(-3)
  })

  it('delta on hp (allows negative result)', () => {
    expect(resolveNewValue({ kind: 'delta', value: -30 }, 10, max, 'hp')).toBe(-20)
  })

  it('delta on hp allows exceeding max', () => {
    expect(resolveNewValue({ kind: 'delta', value: 100 }, 10, max, 'hp')).toBe(110)
  })

  it('respects clampMax option for hp', () => {
    expect(resolveNewValue({ kind: 'delta', value: 100 }, 10, max, 'hp', { clampMax: true })).toBe(max)
    expect(resolveNewValue({ kind: 'absolute', value: 99 }, 10, max, 'hp', { clampMax: true })).toBe(max)
  })

  it('respects clampMax option for mp', () => {
    expect(resolveNewValue({ kind: 'absolute', value: 99 }, 5, 12, 'mp', { clampMax: true })).toBe(12)
  })

  it('delta on mp clamps at 0', () => {
    expect(resolveNewValue({ kind: 'delta', value: -30 }, 5, 12, 'mp')).toBe(0)
  })

  it('absolute on mp clamps at 0 but allows exceeding max', () => {
    expect(resolveNewValue({ kind: 'absolute', value: -3 }, 5, 12, 'mp')).toBe(0)
    expect(resolveNewValue({ kind: 'absolute', value: 99 }, 5, 12, 'mp')).toBe(99)
  })
})
