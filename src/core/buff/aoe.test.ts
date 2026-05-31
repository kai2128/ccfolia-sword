import type { PieceSnapshot } from '@/ccfolia/pieces-store'
import type { GridConfig } from '@/core/range/types'
import type { AttachAoe, BuffInstance } from '@/types/buff-v3'
import { describe, expect, it } from 'vitest'
import { computeCoverage } from './aoe'

const GRID: GridConfig = {
  cols: 19,
  rows: 34,
  gridSize: 1,
  cellSizePx: 40,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'center',
}

function piece(id: string, col: number, row: number): PieceSnapshot {
  // 让 1×1 piece 的 box 底边中点落在 cell (col, row) 中心。
  // bottom-center = (x + 20, y + 40) = ((col+0.5)*40, (row+0.5)*40),所以 x=col*40, y=(row-0.5)*40。
  return {
    characterId: id,
    x: col * 40,
    y: (row - 0.5) * 40,
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
    // radius=1 → 像素半径 = 1*40 = 40(1 格),自身格中心(d=0)被覆盖
    const cov = computeCoverage(aoeBuff({ radius: 1 }), [center], GRID)
    expect(cov.has('center')).toBe(true)
  })

  it('covers a radius of N cells from center (1 cell = 1m)', () => {
    // radius=3 → 像素半径 = 3*40 = 120(3 格)。从格心向外 半格+1+1+半格 触及第 3 格中心。
    const a = piece('a', 5, 6) // 正交距离 1 = 40px → in
    const b = piece('b', 8, 5) // 正交距离 3 = 120px → in(正好在圆边)
    const c = piece('c', 9, 5) // 正交距离 4 = 160px → out
    const cov = computeCoverage(aoeBuff({ radius: 3 }), [center, a, b, c], GRID)
    expect(cov.has('a')).toBe(true)
    expect(cov.has('b')).toBe(true)
    expect(cov.has('c')).toBe(false)
  })

  it('uses Euclidean distance (excludes Chebyshev-corner cells outside pixel circle)', () => {
    // radius=3 → 像素半径 = 3*40 = 120(3 格)。对角角落格欧氏距离 > 120 不算覆盖。
    const diag1 = piece('diag1', 7, 7) // both 2, 距离 80√2 ≈ 113 → in
    const diag2 = piece('diag2', 8, 8) // both 3, 距离 120√2 ≈ 170 → out(Chebyshev 下是 3 却在圆外)
    const ortho = piece('ortho', 8, 5) // 3 横, 距离 120 → in
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

  it('uses piece bottom-center for multi-cell pieces', () => {
    // 2×2 piece (widthPx=heightPx=80),想让 box 底边中点落在 cell (5,5) 中心 (220,220):
    // x = 220 - 40 = 180,y = 220 - 80 = 140。
    const big: PieceSnapshot = {
      characterId: 'big',
      x: 180,
      y: 140,
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
    // radius=2 → 像素半径 = 2*40 = 80(2 格)。正交距离 2 被覆盖(圆边),距离 3 不被覆盖。
    buff.attachedTo = { kind: 'aoe', centerCharacterId: 'big', radius: 2 }
    const near = piece('near', 5, 3) // 正交距离 2 = 80px → in
    const far = piece('far', 5, 2) // 正交距离 3 = 120px → out
    const cov = computeCoverage(buff, [big, near, far], GRID)
    expect(cov.has('near')).toBe(true)
    expect(cov.has('far')).toBe(false)
  })
})
