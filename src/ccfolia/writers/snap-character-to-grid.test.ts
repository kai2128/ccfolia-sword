import type { GridConfig } from '@/core/range/types'
import { describe, expect, it } from 'vitest'
import { boxTopLeftForCellBottomCenter, cellToPx } from '@/core/range'
import { computeSnapWrite } from './snap-character-to-grid'

const GRID_24: GridConfig = {
  cols: 19,
  rows: 34,
  gridSize: 1,
  cellSizePx: 24,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'top-left',
}

describe('computeSnapWrite', () => {
  it('用传入的(新鲜)坐标算吸附目标 —— 自由落点 → 最近格', () => {
    const size = { widthCells: 1, heightCells: 1 }
    const onGrid = boxTopLeftForCellBottomCenter(cellToPx({ col: 3, row: 4 }, GRID_24), size, GRID_24)
    // 模拟拖动后的自由落点(偏移几像素),决策必须基于这个坐标本身,而非任何别的来源。
    const free = { x: onGrid.x + 5, y: onGrid.y - 3, width: 1, height: 1 }
    expect(computeSnapWrite(free, GRID_24)).toEqual(onGrid)
  })

  it('已经对齐 → null(免写)', () => {
    const onGrid = boxTopLeftForCellBottomCenter(cellToPx({ col: 3, row: 4 }, GRID_24), { widthCells: 1, heightCells: 1 }, GRID_24)
    expect(computeSnapWrite({ ...onGrid, width: 1, height: 1 }, GRID_24)).toBeNull()
  })

  it('脚下在场外 → null(保持自由)', () => {
    expect(computeSnapWrite({ x: -500, y: -500, width: 1, height: 1 }, GRID_24)).toBeNull()
  })

  it('坐标非法 → null', () => {
    expect(computeSnapWrite({ x: 'nope', y: null, width: 1, height: 1 }, GRID_24)).toBeNull()
  })
})
