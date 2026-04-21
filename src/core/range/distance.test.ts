import { describe, expect, it } from 'vitest'
import { chebyshev, queryInRange } from './distance'

describe('chebyshev', () => {
  it('same cell -> 0', () => {
    expect(chebyshev({ col: 3, row: 5 }, { col: 3, row: 5 })).toBe(0)
  })

  it('adjacent orthogonal -> 1', () => {
    expect(chebyshev({ col: 3, row: 5 }, { col: 4, row: 5 })).toBe(1)
    expect(chebyshev({ col: 3, row: 5 }, { col: 3, row: 6 })).toBe(1)
  })

  it('adjacent diagonal -> 1(Chebyshev 特征)', () => {
    expect(chebyshev({ col: 3, row: 5 }, { col: 4, row: 6 })).toBe(1)
    expect(chebyshev({ col: 3, row: 5 }, { col: 2, row: 4 })).toBe(1)
  })

  it('knight-like (+2,+1) -> 2', () => {
    expect(chebyshev({ col: 0, row: 0 }, { col: 2, row: 1 })).toBe(2)
  })

  it('symmetric', () => {
    expect(chebyshev({ col: 0, row: 0 }, { col: 5, row: 3 })).toBe(
      chebyshev({ col: 5, row: 3 }, { col: 0, row: 0 }),
    )
  })
})

describe('queryInRange', () => {
  const center = { col: 5, row: 5 }
  const actors = [
    { id: 'a', cell: { col: 5, row: 5 } },
    { id: 'b', cell: { col: 6, row: 5 } },
    { id: 'c', cell: { col: 7, row: 7 } },
    { id: 'd', cell: { col: 8, row: 5 } },
    { id: 'e', cell: { col: 3, row: 3 } },
  ]

  it('radius 0 only self', () => {
    expect(queryInRange(center, 0, actors).map(a => a.id)).toEqual(['a'])
  })

  it('radius 1 gets self + b', () => {
    expect(queryInRange(center, 1, actors).map(a => a.id).sort()).toEqual(['a', 'b'])
  })

  it('radius 2 gets a,b,c,e', () => {
    expect(queryInRange(center, 2, actors).map(a => a.id).sort()).toEqual(['a', 'b', 'c', 'e'])
  })

  it('radius 5 gets everyone', () => {
    expect(queryInRange(center, 5, actors).map(a => a.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('empty input', () => {
    expect(queryInRange(center, 10, [])).toEqual([])
  })
})
