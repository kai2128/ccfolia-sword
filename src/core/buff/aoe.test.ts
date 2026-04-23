import type { PieceSnapshot } from '@/ccfolia/pieces-store'
import type { GridConfig } from '@/core/range/types'
import type { AttachAoe, BuffInstance } from '@/types/buff-v3'
import { describe, expect, it } from 'vitest'
import { computeCoverage } from './aoe'

const GRID: GridConfig = {
  cols: 19,
  rows: 34,
  cellSizePx: 40,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'center',
}

function piece(id: string, col: number, row: number): PieceSnapshot {
  // center-anchor: (col + 0.5) * 40, (row + 0.5) * 40
  return {
    characterId: id,
    x: (col + 0.5) * 40,
    y: (row + 0.5) * 40,
    widthCells: 1,
    heightCells: 1,
    z: 0,
    angle: 0,
    invisible: false,
    hideStatus: false,
  }
}

function aoeBuff(attach: Partial<AttachAoe>, enabled = true): BuffInstance {
  return {
    id: 'b1',
    definitionId: 'd',
    snapshot: { name: '', icon: '', description: '', modifiers: [], polarity: 'positive' },
    attachedTo: {
      kind: 'aoe',
      centerCharacterId: 'center',
      radius: 2,
      ...attach,
    },
    lifecycle: 'encounter',
    enabled,
    attachedAtTurn: 1,
  }
}

describe('computeCoverage', () => {
  const center = piece('center', 5, 5)

  it('includes center itself', () => {
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center], GRID)
    expect(cov.has('center')).toBe(true)
  })

  it('includes pieces within Chebyshev radius', () => {
    const a = piece('a', 5, 7) // row distance = 2
    const b = piece('b', 7, 5) // col distance = 2
    const c = piece('c', 8, 5) // distance 3 (out)
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center, a, b, c], GRID)
    expect(cov.has('a')).toBe(true)
    expect(cov.has('b')).toBe(true)
    expect(cov.has('c')).toBe(false)
  })

  it('treats diagonals as distance = max(|dx|,|dy|)', () => {
    const diag = piece('diag', 7, 7) // both 2
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center, diag], GRID)
    expect(cov.has('diag')).toBe(true)
  })

  it('excludes pieces with no grid cell (off-grid)', () => {
    const off: PieceSnapshot = {
      characterId: 'off',
      x: -999,
      y: -999,
      widthCells: 1,
      heightCells: 1,
      z: 0,
      angle: 0,
      invisible: false,
      hideStatus: false,
    }
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center, off], GRID)
    expect(cov.has('off')).toBe(false)
  })

  it('includeOverride adds out-of-range pieces', () => {
    const far = piece('far', 10, 10)
    const cov = computeCoverage(aoeBuff({ radius: 2, includeOverride: ['far'] }), [center, far], GRID)
    expect(cov.has('far')).toBe(true)
  })

  it('excludeOverride removes in-range pieces', () => {
    const near = piece('near', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2, excludeOverride: ['near'] }), [center, near], GRID)
    expect(cov.has('near')).toBe(false)
  })

  it('exclude wins over include when both list same id', () => {
    const near = piece('near', 5, 6)
    const cov = computeCoverage(
      aoeBuff({ radius: 2, includeOverride: ['near'], excludeOverride: ['near'] }),
      [center, near],
      GRID,
    )
    expect(cov.has('near')).toBe(false)
  })

  it('returns empty set if center piece missing', () => {
    const a = piece('a', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [a], GRID) // no 'center' piece
    expect(cov.size).toBe(0)
  })

  it('disabled buff still returns full coverage (UI uses grey-out, not removal)', () => {
    const near = piece('near', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2 }, false), [center, near], GRID)
    expect(cov.has('near')).toBe(true)
  })
})
