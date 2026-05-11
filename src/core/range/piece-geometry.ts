import type { GridConfig } from './types'
import { pxToCell } from './grid'

export interface PieceBoxLike {
  x: number
  y: number
  widthCells: number
  heightCells: number
}

// 与 useOnCanvasIds / RosterRow / move-character-by-cells 共用的"脚下落在 cell 底边"补偿:
// 底边中点正好落在 cell 底边时 pxToCell 的 floor 会推到下一格,所以回缩 eps 拉回当前格内侧。
export const CELL_BOUNDARY_EPS = 0.001

function pieceCellSizePx(grid: GridConfig): number {
  const gridSize = Number.isFinite(grid.gridSize) && grid.gridSize > 0 ? grid.gridSize : 1
  return grid.cellSizePx / gridSize
}

function pieceSizePx(
  size: { widthCells: number, heightCells: number },
  grid: GridConfig,
): { width: number, height: number } {
  const cellPx = pieceCellSizePx(grid)
  return {
    width: size.widthCells * cellPx,
    height: size.heightCells * cellPx,
  }
}

// ccfolia 立绘 <img> 是 bottom:0/width:100%,角色名 Label 紧贴 box 底边外侧 ——
// "脚下" = box 底边中点 = .movable 左上角 + (widthPx/2, heightPx)。
// range 圆心 / Fx 起始 / 板内外判定 / 写回 cell 都按这个口径,达成"feet on cell"语义。
export function pieceBottomCenter(p: PieceBoxLike, grid: GridConfig): { x: number, y: number } {
  const sizePx = pieceSizePx(p, grid)
  return {
    x: p.x + sizePx.width / 2,
    y: p.y + sizePx.height,
  }
}

// 角色实际站立的格心。ccfolia box 底边中点在站立格底边,视觉/判定锚点需要上移半个视觉格。
export function pieceStandingCellCenter(p: PieceBoxLike, grid: GridConfig): { x: number, y: number } {
  const bottomCenter = pieceBottomCenter(p, grid)
  return {
    x: bottomCenter.x,
    y: bottomCenter.y - grid.cellSizePx / 2,
  }
}

// 角色"脚下"是否落在主板格网内。x/y 缺失或非有限数 → 视为场外。
// invisible / hideStatus 不在这里判断 —— 调用方需要时自己叠。
export function isPieceOffBoard(
  p: { x?: unknown, y?: unknown, widthCells: number, heightCells: number },
  grid: GridConfig,
): boolean {
  if (typeof p.x !== 'number' || typeof p.y !== 'number')
    return true
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
    return true
  const bc = pieceBottomCenter({ x: p.x, y: p.y, widthCells: p.widthCells, heightCells: p.heightCells }, grid)
  return pxToCell({ x: bc.x, y: bc.y - CELL_BOUNDARY_EPS }, grid) === null
}

// 反向:让 box 底边中点落在 cell 底边中点,反推 .movable 左上角。
// setCharacterCell / moveCharacterByCells 写回 ccfolia 时统一走这个。
export function boxTopLeftForCellBottomCenter(
  cellTopLeft: { x: number, y: number },
  size: { widthCells: number, heightCells: number },
  grid: GridConfig,
): { x: number, y: number } {
  const sizePx = pieceSizePx(size, grid)
  return {
    x: cellTopLeft.x + grid.cellSizePx / 2 - sizePx.width / 2,
    y: cellTopLeft.y + grid.cellSizePx - sizePx.height,
  }
}

export function clampBoxTopLeftToBoard(
  topLeft: { x: number, y: number },
  size: { widthCells: number, heightCells: number },
  grid: GridConfig,
): { x: number, y: number } {
  const sizePx = pieceSizePx(size, grid)
  const minX = grid.originPx.x
  const minY = grid.originPx.y
  const maxX = grid.originPx.x + grid.cols * grid.cellSizePx - sizePx.width
  const maxY = grid.originPx.y + grid.rows * grid.cellSizePx - sizePx.height
  return {
    x: Math.min(Math.max(topLeft.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(topLeft.y, minY), Math.max(minY, maxY)),
  }
}

// Piece "脚下"那一格的左上角 px ——整格语义:box 底边对齐 cell 底边、box 左边对齐 cell 左边,
// 输入 "1A" → box 占据 1A 起向上 N 行的 N×M 个 cell,1A 就是脚下那一格(footprint 的 bottom-left)。
// 喂给 pxToCell 即可拿到"脚下 cell"的 (col, row)。
export function pieceFootCellAnchor(p: PieceBoxLike, grid: GridConfig): { x: number, y: number } {
  const cellPx = pieceCellSizePx(grid)
  return {
    x: p.x,
    y: p.y + (p.heightCells - 1) * cellPx,
  }
}

// 反向:让 piece 脚下那一格落在指定 cell,反推 .movable 左上角(整格映射,无半格 gap)。
export function boxTopLeftForFootCell(
  cellTopLeft: { x: number, y: number },
  size: { widthCells: number, heightCells: number },
  grid: GridConfig,
): { x: number, y: number } {
  const cellPx = pieceCellSizePx(grid)
  return {
    x: cellTopLeft.x,
    y: cellTopLeft.y - (size.heightCells - 1) * cellPx,
  }
}

// box 几何中心 —— 当前不用,留作未来需要"几何中心锚点"语义时复用(例如非 ccfolia bottom-anchor 渲染)。
export function pieceBoxCenter(p: PieceBoxLike, grid: GridConfig): { x: number, y: number } {
  const sizePx = pieceSizePx(p, grid)
  return {
    x: p.x + sizePx.width / 2,
    y: p.y + sizePx.height / 2,
  }
}

// 反向:让 box 几何中心落在 cell 中心,反推 .movable 左上角。与 pieceBoxCenter 配套保留。
export function boxTopLeftForCellCenter(
  cellTopLeft: { x: number, y: number },
  size: { widthCells: number, heightCells: number },
  grid: GridConfig,
): { x: number, y: number } {
  const sizePx = pieceSizePx(size, grid)
  return {
    x: cellTopLeft.x + grid.cellSizePx / 2 - sizePx.width / 2,
    y: cellTopLeft.y + grid.cellSizePx / 2 - sizePx.height / 2,
  }
}
