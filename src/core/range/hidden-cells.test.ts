import { describe, expect, it } from 'vitest'
import { cellKey, formatHiddenCells, parseCellKey, parseHiddenCells } from './hidden-cells'

describe('cellKey / parseCellKey', () => {
  it('round-trips a cell', () => {
    expect(cellKey(5, 10)).toBe('5,10')
    expect(parseCellKey('5,10')).toEqual({ col: 5, row: 10 })
  })

  it('parseCellKey rejects malformed', () => {
    expect(parseCellKey('')).toBeNull()
    expect(parseCellKey('5')).toBeNull()
    expect(parseCellKey('a,b')).toBeNull()
    expect(parseCellKey('-1,2')).toBeNull()
  })
})

describe('parseHiddenCells', () => {
  it('parses empty string to empty set', () => {
    expect(parseHiddenCells('').size).toBe(0)
  })

  it('parses multiple cells', () => {
    const set = parseHiddenCells('0,3;5,10')
    expect(set.has('0,3')).toBe(true)
    expect(set.has('5,10')).toBe(true)
    expect(set.size).toBe(2)
  })

  it('ignores whitespace and malformed tokens', () => {
    const set = parseHiddenCells(' 0,3 ; ; junk ; 5,10 ')
    expect(set.size).toBe(2)
    expect(set.has('0,3')).toBe(true)
    expect(set.has('5,10')).toBe(true)
  })

  it('dedupes', () => {
    expect(parseHiddenCells('1,1;1,1').size).toBe(1)
  })
})

describe('formatHiddenCells', () => {
  it('empty set -> empty string', () => {
    expect(formatHiddenCells(new Set())).toBe('')
  })

  it('sorts stably by col then row', () => {
    expect(formatHiddenCells(new Set(['5,10', '0,3', '0,1']))).toBe('0,1;0,3;5,10')
  })

  it('round-trips with parse (idempotent)', () => {
    const s = '0,1;0,3;5,10'
    expect(formatHiddenCells(parseHiddenCells(s))).toBe(s)
  })
})
