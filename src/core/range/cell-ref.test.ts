import { describe, expect, it } from 'vitest'
import { formatCellRef, parseCellDelta, parseCellRef } from './cell-ref'
import { DEFAULT_GRID_CONFIG } from './types'

const cfg = DEFAULT_GRID_CONFIG

describe('parseCellRef', () => {
  it('parses "1A" -> col 0 row 0', () => {
    expect(parseCellRef('1A', cfg)).toEqual({ col: 0, row: 0 })
  })

  it('parses "5J" -> col 9 row 4', () => {
    expect(parseCellRef('5J', cfg)).toEqual({ col: 9, row: 4 })
  })

  it('parses "34S" -> col 18 row 33', () => {
    expect(parseCellRef('34S', cfg)).toEqual({ col: 18, row: 33 })
  })

  it('accepts lowercase: "5j"', () => {
    expect(parseCellRef('5j', cfg)).toEqual({ col: 9, row: 4 })
  })

  it('trims whitespace', () => {
    expect(parseCellRef('  5J  ', cfg)).toEqual({ col: 9, row: 4 })
  })

  it('returns null on empty / malformed', () => {
    expect(parseCellRef('', cfg)).toBeNull()
    expect(parseCellRef('J5', cfg)).toBeNull()
    expect(parseCellRef('5', cfg)).toBeNull()
    expect(parseCellRef('J', cfg)).toBeNull()
    expect(parseCellRef('5 J', cfg)).toBeNull()
  })

  it('returns null on out-of-range', () => {
    expect(parseCellRef('0A', cfg)).toBeNull()
    expect(parseCellRef('35A', cfg)).toBeNull()
    expect(parseCellRef('5T', cfg)).toBeNull()
    expect(parseCellRef('5AA', cfg)).toBeNull()
  })
})

describe('formatCellRef', () => {
  it('formats col 0 row 0 -> "1A"', () => {
    expect(formatCellRef({ col: 0, row: 0 })).toBe('1A')
  })

  it('formats col 9 row 4 -> "5J"', () => {
    expect(formatCellRef({ col: 9, row: 4 })).toBe('5J')
  })

  it('formats col 18 row 33 -> "34S"', () => {
    expect(formatCellRef({ col: 18, row: 33 })).toBe('34S')
  })
})

describe('parseCellDelta', () => {
  it('parses directional shorthand', () => {
    expect(parseCellDelta('u10')).toEqual({ dx: 0, dy: -10 })
    expect(parseCellDelta('d3')).toEqual({ dx: 0, dy: 3 })
    expect(parseCellDelta('l2')).toEqual({ dx: -2, dy: 0 })
    expect(parseCellDelta('r5')).toEqual({ dx: 5, dy: 0 })
  })

  it('directional shorthand is case-insensitive and trims', () => {
    expect(parseCellDelta('  U7  ')).toEqual({ dx: 0, dy: -7 })
  })

  it('parses dRow,dCol with signs', () => {
    expect(parseCellDelta('+2,-3')).toEqual({ dx: -3, dy: 2 })
    expect(parseCellDelta('2,-3')).toEqual({ dx: -3, dy: 2 })
    expect(parseCellDelta('-3,0')).toEqual({ dx: 0, dy: -3 })
    expect(parseCellDelta('0, 5')).toEqual({ dx: 5, dy: 0 })
  })

  it('does not collide with absolute "5J" form', () => {
    expect(parseCellDelta('5J')).toBeNull()
    expect(parseCellDelta('5j')).toBeNull()
  })

  it('returns null on empty / malformed', () => {
    expect(parseCellDelta('')).toBeNull()
    expect(parseCellDelta('u')).toBeNull()
    expect(parseCellDelta('u0')).toBeNull()
    expect(parseCellDelta('x3')).toBeNull()
    expect(parseCellDelta('u-1')).toBeNull()
    expect(parseCellDelta('1,2,3')).toBeNull()
  })
})

describe('round-trip', () => {
  it('parse(format(c)) === c for all valid cells', () => {
    for (let col = 0; col < cfg.cols; col++) {
      for (let row = 0; row < cfg.rows; row++) {
        const ref = { col, row }
        expect(parseCellRef(formatCellRef(ref), cfg)).toEqual(ref)
      }
    }
  })
})
