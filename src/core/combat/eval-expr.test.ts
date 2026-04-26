import { describe, expect, it } from 'vitest'
import { applyAdjustment, evaluateExpression } from './eval-expr'

describe('evaluateExpression', () => {
  it('parses bare integers', () => {
    expect(evaluateExpression('17')).toBe(17)
    expect(evaluateExpression('0')).toBe(0)
  })

  it('handles unary +/-', () => {
    expect(evaluateExpression('+5')).toBe(5)
    expect(evaluateExpression('-3')).toBe(-3)
    expect(evaluateExpression('--3')).toBe(3)
  })

  it('respects + - * / precedence', () => {
    expect(evaluateExpression('1+2*3')).toBe(7)
    expect(evaluateExpression('10-6/2')).toBe(7)
    expect(evaluateExpression('+1-1/2*2')).toBe(0)
    expect(evaluateExpression('2*3+4')).toBe(10)
  })

  it('rounds float results to nearest int', () => {
    expect(evaluateExpression('1/2')).toBe(1) // 0.5 → 1
    expect(evaluateExpression('1/3')).toBe(0) // 0.333 → 0
    expect(evaluateExpression('5/3')).toBe(2) // 1.666 → 2
  })

  it('handles parens', () => {
    expect(evaluateExpression('(1+2)*3')).toBe(9)
    expect(evaluateExpression('-(1+2)')).toBe(-3)
    expect(evaluateExpression('((1+2))')).toBe(3)
  })

  it('ignores whitespace', () => {
    expect(evaluateExpression(' 1 + 2 ')).toBe(3)
    expect(evaluateExpression('+ 5')).toBe(5)
  })

  it('returns null on invalid input', () => {
    expect(evaluateExpression('')).toBe(null)
    expect(evaluateExpression('1+')).toBe(null) // trailing op
    expect(evaluateExpression('+')).toBe(null) // unary alone
    expect(evaluateExpression('(1+2')).toBe(null) // unclosed paren
    expect(evaluateExpression('1+2)')).toBe(null) // extra paren
    expect(evaluateExpression('1abc')).toBe(null) // letters
    expect(evaluateExpression('1.5')).toBe(null) // decimals not allowed
  })

  it('treats div-by-zero as null (not Infinity)', () => {
    expect(evaluateExpression('1/0')).toBe(null)
  })
})

describe('applyAdjustment', () => {
  it('= prefix sets absolute (allows negative)', () => {
    expect(applyAdjustment('=10', 5)).toBe(10)
    expect(applyAdjustment('=-5', 5)).toBe(-5)
    expect(applyAdjustment('=10+5', 5)).toBe(15)
  })

  it('+ prefix adds to current', () => {
    expect(applyAdjustment('+5', 10)).toBe(15)
    expect(applyAdjustment('+1*2', 10)).toBe(12)
  })

  it('- prefix subtracts from current', () => {
    expect(applyAdjustment('-3', 10)).toBe(7)
    expect(applyAdjustment('-30', 10)).toBe(-20) // can go negative
  })

  it('* prefix multiplies current', () => {
    expect(applyAdjustment('*2', 10)).toBe(20)
    expect(applyAdjustment('*3', 7)).toBe(21)
  })

  it('/ prefix divides current (rounded to int)', () => {
    expect(applyAdjustment('/2', 10)).toBe(5)
    expect(applyAdjustment('/3', 10)).toBe(3) // 3.33 → 3
    expect(applyAdjustment('/2', 7)).toBe(4) // 3.5 → 4
  })

  it('respects precedence with + prefix and chained ops', () => {
    // current=10, "+1-1/2*2" → 10 + 1 - (1/2)*2 = 10 + 1 - 1 = 10
    expect(applyAdjustment('+1-1/2*2', 10)).toBe(10)
  })

  it('no prefix is absolute expression', () => {
    expect(applyAdjustment('17', 5)).toBe(17)
    expect(applyAdjustment('5+3', 10)).toBe(8)
    expect(applyAdjustment('2*5', 10)).toBe(10)
  })

  it('returns null on invalid input', () => {
    expect(applyAdjustment('', 5)).toBe(null)
    expect(applyAdjustment('abc', 5)).toBe(null)
    expect(applyAdjustment('+', 5)).toBe(null)
    expect(applyAdjustment('1.5', 5)).toBe(null) // decimals not allowed
  })

  it('trims whitespace', () => {
    expect(applyAdjustment('  +5  ', 10)).toBe(15)
  })
})
