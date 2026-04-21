/**
 * ccfolia 画布里的一格。col 0..cols-1 映射 'A'..'S',row 0..rows-1 映射 '1'..'34'。
 */
export interface CellRef {
  col: number
  row: number
}

/**
 * 格系统配置。spec §4.3:光有 cellSizePx 不够,必须 originPx + pieceAnchor 才能把 piece.x/y 唯一映射到格。
 */
export interface GridConfig {
  cols: number
  rows: number
  cellSizePx: number
  originPx: { x: number, y: number }
  pieceAnchor: 'center' | 'top-left'
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  cols: 19,
  rows: 34,
  cellSizePx: 50,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'center',
}
