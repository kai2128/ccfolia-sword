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

// cellSizePx 默认 24 = ccfolia 硬编码 cellSize。sword 一格 = ccfolia 一格,
// 用户在 ccfolia 房间把 fieldWidth/Height 设为 19×34,从 Settings tab 点「从画布校准」即可映射到 SW2.5 标准棋盘。
export const DEFAULT_GRID_CONFIG: GridConfig = {
  cols: 19,
  rows: 34,
  cellSizePx: 24,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'center',
}
