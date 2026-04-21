import { describe, expect, it } from 'vitest'
import { formatCellRef, parseCellRef } from './cell-ref'
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
