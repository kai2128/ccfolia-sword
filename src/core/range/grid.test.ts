import type { GridConfig } from './types'
import { describe, expect, it } from 'vitest'
import { cellToPx, pxToCell } from './grid'

// origin 在 (0,0)、cellSize 50、center anchor
const cfgCenter: GridConfig = {
  cols: 19,
  rows: 34,
  gridSize: 1,
  cellSizePx: 50,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'center',
}

// 同上,但 piece.x/y 是立绘左上角
const cfgTopLeft: GridConfig = { ...cfgCenter, pieceAnchor: 'top-left' }

// origin 偏移 (100, 200)
const cfgOffset: GridConfig = { ...cfgCenter, originPx: { x: 100, y: 200 } }

describe('pxToCell · center anchor', () => {
  it('piece at center of 1A -> { col:0, row:0 }', () => {
    expect(pxToCell({ x: 25, y: 25 }, cfgCenter)).toEqual({ col: 0, row: 0 })
  })

  it('piece at center of 5J -> { col:9, row:4 }', () => {
    expect(pxToCell({ x: 475, y: 225 }, cfgCenter)).toEqual({ col: 9, row: 4 })
  })

  it('returns null when piece is left of grid', () => {
    expect(pxToCell({ x: -10, y: 25 }, cfgCenter)).toBeNull()
  })

  it('returns null when piece is below grid', () => {
    expect(pxToCell({ x: 25, y: 1725 }, cfgCenter)).toBeNull()
  })
})

describe('pxToCell · top-left anchor', () => {
  it('piece at top-left of 1A -> { col:0, row:0 }', () => {
    expect(pxToCell({ x: 0, y: 0 }, cfgTopLeft)).toEqual({ col: 0, row: 0 })
  })

  it('piece at top-left of 5J -> { col:9, row:4 }', () => {
    expect(pxToCell({ x: 450, y: 200 }, cfgTopLeft)).toEqual({ col: 9, row: 4 })
  })
})

describe('pxToCell · origin offset', () => {
  it('honors originPx offset', () => {
    expect(pxToCell({ x: 125, y: 225 }, cfgOffset)).toEqual({ col: 0, row: 0 })
  })

  it('returns null for piece inside grid in un-offset coord but outside after offset', () => {
    expect(pxToCell({ x: 25, y: 25 }, cfgOffset)).toBeNull()
  })
})

describe('cellToPx · center anchor', () => {
  it('1A -> (25, 25)', () => {
    expect(cellToPx({ col: 0, row: 0 }, cfgCenter)).toEqual({ x: 25, y: 25 })
  })

  it('5J -> (475, 225)', () => {
    expect(cellToPx({ col: 9, row: 4 }, cfgCenter)).toEqual({ x: 475, y: 225 })
  })
})

describe('cellToPx · top-left anchor', () => {
  it('1A -> (0, 0)', () => {
    expect(cellToPx({ col: 0, row: 0 }, cfgTopLeft)).toEqual({ x: 0, y: 0 })
  })
})

describe('cellToPx · origin offset', () => {
  it('1A with origin (100,200) -> (125, 225)', () => {
    expect(cellToPx({ col: 0, row: 0 }, cfgOffset)).toEqual({ x: 125, y: 225 })
  })
})

describe('round-trip', () => {
  it('pxToCell(cellToPx(c)) === c for every valid cell (center anchor)', () => {
    for (let col = 0; col < cfgCenter.cols; col++) {
      for (let row = 0; row < cfgCenter.rows; row++) {
        const ref = { col, row }
        expect(pxToCell(cellToPx(ref, cfgCenter), cfgCenter)).toEqual(ref)
      }
    }
  })

  it('pxToCell(cellToPx(c)) === c for every valid cell (top-left anchor, offset)', () => {
    const cfg: GridConfig = { ...cfgOffset, pieceAnchor: 'top-left' }
    for (let col = 0; col < cfg.cols; col++) {
      for (let row = 0; row < cfg.rows; row++) {
        const ref = { col, row }
        expect(pxToCell(cellToPx(ref, cfg), cfg)).toEqual(ref)
      }
    }
  })
})
