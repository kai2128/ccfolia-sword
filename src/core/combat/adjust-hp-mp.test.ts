import { describe, expect, it } from 'vitest'
import { resolveNewValue } from './adjust-hp-mp'

describe('resolveNewValue', () => {
  it('delta 加到当前值', () => {
    expect(resolveNewValue(10, { mode: 'delta', input: 5, max: 20 })).toBe(15)
    expect(resolveNewValue(10, { mode: 'delta', input: -3, max: 20 })).toBe(7)
  })

  it('absolute 直接设为输入值', () => {
    expect(resolveNewValue(10, { mode: 'absolute', input: 7, max: 20 })).toBe(7)
    expect(resolveNewValue(10, { mode: 'absolute', input: 0, max: 20 })).toBe(0)
  })

  it('默认 0 截底,delta 不会变负', () => {
    expect(resolveNewValue(3, { mode: 'delta', input: -10, max: 20 })).toBe(0)
    expect(resolveNewValue(0, { mode: 'absolute', input: -5, max: 20 })).toBe(0)
  })

  it('默认不截 max,允许过量治疗', () => {
    expect(resolveNewValue(15, { mode: 'delta', input: 10, max: 20 })).toBe(25)
    expect(resolveNewValue(0, { mode: 'absolute', input: 999, max: 20 })).toBe(999)
  })

  it('clampMax=true 时治疗截到 max', () => {
    expect(resolveNewValue(15, { mode: 'delta', input: 10, max: 20, clampMax: true })).toBe(20)
    expect(resolveNewValue(0, { mode: 'absolute', input: 100, max: 20, clampMax: true })).toBe(20)
  })

  it('clampMin=false 允许负值(用于特殊场景)', () => {
    expect(resolveNewValue(3, { mode: 'delta', input: -10, max: 20, clampMin: false })).toBe(-7)
  })
})
