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
    // radius=1 → 严格 < 1,只有自身格(d=0)被覆盖
    const cov = computeCoverage(aoeBuff({ radius: 1 }), [center], GRID)
    expect(cov.has('center')).toBe(true)
  })

  it('includes pieces strictly within Chebyshev radius', () => {
    // radius=3 → 严格距离 < 3 覆盖(距离 0/1/2),距离 3 正好落在可视圆边上,不算。
    const a = piece('a', 5, 6) // distance 1 → in
    const b = piece('b', 7, 5) // distance 2 → in
    const c = piece('c', 8, 5) // distance 3 → out
    const cov = computeCoverage(aoeBuff({ radius: 3 }), [center, a, b, c], GRID)
    expect(cov.has('a')).toBe(true)
    expect(cov.has('b')).toBe(true)
    expect(cov.has('c')).toBe(false)
  })

  it('uses Euclidean distance (excludes Chebyshev-corner cells outside pixel circle)', () => {
    // radius=3 → 像素半径 = (2*3-1)*40/2 = 100. 对角角落格欧氏距离 > 100 不算覆盖。
    const diag1 = piece('diag1', 6, 6) // both 1, 距离 40√2 ≈ 56.6 → in
    const diag2 = piece('diag2', 7, 7) // both 2, 距离 80√2 ≈ 113 → out(Chebyshev 下是 2 却在圆外)
    const ortho = piece('ortho', 7, 5) // 2 横, 距离 80 → in
    const cov = computeCoverage(aoeBuff({ radius: 3 }), [center, diag1, diag2, ortho], GRID)
    expect(cov.has('diag1')).toBe(true)
    expect(cov.has('diag2')).toBe(false)
    expect(cov.has('ortho')).toBe(true)
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
    const near = piece('near', 5, 6) // d=1, in for radius=2
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
    const near = piece('near', 5, 6) // d=1, in for radius=2
    const cov = computeCoverage(aoeBuff({ radius: 2 }, false), [center, near], GRID)
    expect(cov.has('near')).toBe(true)
  })

  it('uses piece bounding-box center for multi-cell pieces', () => {
    // widthCells/heightCells 单位是 ccfolia 格(= sword 格),2×2 piece 几何中心在 (6×40, 6×40)。
    const big: PieceSnapshot = {
      characterId: 'big',
      x: 5 * 40,
      y: 5 * 40,
      widthCells: 2,
      heightCells: 2,
      z: 0,
      angle: 0,
      invisible: false,
      hideStatus: false,
    }
    const buff: BuffInstance = {
      id: 'b',
      definitionId: 'd',
      snapshot: { name: '', icon: '', description: '', modifiers: [], polarity: 'positive' },
      attachedTo: { kind: 'aoe', centerCharacterId: 'big', radius: 1 },
      lifecycle: 'encounter',
      enabled: true,
      attachedAtTurn: 1,
    }
    // radius=2 严格 < 2 → 距离 1 的格被覆盖,距离 2 的格不被覆盖
    buff.attachedTo = { kind: 'aoe', centerCharacterId: 'big', radius: 2 }
    const near = piece('near', 4, 4) // distance 1 → in
    const far = piece('far', 3, 3) // distance 2 → out (在圆边)
    const cov = computeCoverage(buff, [big, near, far], GRID)
    expect(cov.has('near')).toBe(true)
    expect(cov.has('far')).toBe(false)
  })
})
