import type { GridConfig } from './types'
import { describe, expect, it } from 'vitest'
import { boxTopLeftForCellBottomCenter, cellToPx, clampBoxTopLeftToBoard, pieceBottomCenter, pxToCell } from './index'

const GRID_24: GridConfig = {
  cols: 19,
  rows: 34,
  gridSize: 1,
  cellSizePx: 24,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'top-left',
}

const GRID_48: GridConfig = {
  ...GRID_24,
  gridSize: 2,
  cellSizePx: 48,
}

describe('piece bottom-center reverse mapping', () => {
  it('places a 1x1 native piece on an integer 24px cell with no half-cell gap', () => {
    const size = { widthCells: 1, heightCells: 1 }
    const topLeft = boxTopLeftForCellBottomCenter(cellToPx({ col: 3, row: 4 }, GRID_24), size, GRID_24)

    expect(topLeft).toEqual({ x: 72, y: 96 })
    expect(pieceBottomCenter({ ...topLeft, ...size }, GRID_24)).toEqual({ x: 84, y: 120 })
    expect(pxToCell({ x: 84, y: 120 - 0.001 }, GRID_24)).toEqual({ col: 3, row: 4 })
  })

  it('keeps the piece box in native 24px units when visual gridSize is 2', () => {
    const size = { widthCells: 1, heightCells: 1 }
    const topLeft = boxTopLeftForCellBottomCenter(cellToPx({ col: 3, row: 4 }, GRID_48), size, GRID_48)

    expect(topLeft).toEqual({ x: 156, y: 216 })
    expect(pieceBottomCenter({ ...topLeft, ...size }, GRID_48)).toEqual({ x: 168, y: 240 })
    expect(pxToCell({ x: 168, y: 240 - 0.001 }, GRID_48)).toEqual({ col: 3, row: 4 })
  })

  it('clamps top-row targets so the movable box never overflows above the board', () => {
    const size = { widthCells: 2, heightCells: 2 }
    const targetTopLeft = boxTopLeftForCellBottomCenter(cellToPx({ col: 0, row: 0 }, GRID_24), size, GRID_24)
    const clamped = clampBoxTopLeftToBoard(targetTopLeft, size, GRID_24)

    expect(targetTopLeft).toEqual({ x: -12, y: -24 })
    expect(clamped).toEqual({ x: 0, y: 0 })
  })
})
