import type { GridConfig } from './types'

export interface PieceBoxLike {
  x: number
  y: number
  widthCells: number
  heightCells: number
}

// ccfolia 把 character.x/y 当作 .movable 的左上角,box 中心 = 左上角 + (widthCells/heightCells × cellSizePx)/2。
export function pieceBoxCenter(p: PieceBoxLike, grid: GridConfig): { x: number, y: number } {
  return {
    x: p.x + (p.widthCells * grid.cellSizePx) / 2,
    y: p.y + (p.heightCells * grid.cellSizePx) / 2,
  }
}

// 反向:给定 cell 左上角,反推让 box 中心落在 cell 中心的 .movable 左上角。
// setCharacterCell / moveCharacterByCells 写回 ccfolia 时统一走这个,避免 piece 左上角偏一格。
export function boxTopLeftForCellCenter(
  cellTopLeft: { x: number, y: number },
  size: { widthCells: number, heightCells: number },
  grid: GridConfig,
): { x: number, y: number } {
  return {
    x: cellTopLeft.x + grid.cellSizePx / 2 - (size.widthCells * grid.cellSizePx) / 2,
    y: cellTopLeft.y + grid.cellSizePx / 2 - (size.heightCells * grid.cellSizePx) / 2,
  }
}
