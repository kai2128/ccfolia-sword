import type { CellRef, GridConfig } from './types'

/**
 * piece 屏幕坐标 → 格;piece 落在格网外返回 null。
 * anchor='center' 时先把中心退回左上角再按格宽取整。
 */
export function pxToCell(
  piece: { x: number, y: number },
  cfg: GridConfig,
): CellRef | null {
  const half = cfg.cellSizePx / 2
  const anchorX = cfg.pieceAnchor === 'center' ? piece.x - half : piece.x
  const anchorY = cfg.pieceAnchor === 'center' ? piece.y - half : piece.y
  const col = Math.floor((anchorX - cfg.originPx.x) / cfg.cellSizePx)
  const row = Math.floor((anchorY - cfg.originPx.y) / cfg.cellSizePx)
  if (col < 0 || col >= cfg.cols)
    return null
  if (row < 0 || row >= cfg.rows)
    return null
  return { col, row }
}

/**
 * 格 → piece 屏幕坐标;anchor='center' 返回中心,'top-left' 返回左上角。
 */
export function cellToPx(
  ref: CellRef,
  cfg: GridConfig,
): { x: number, y: number } {
  const cornerX = cfg.originPx.x + ref.col * cfg.cellSizePx
  const cornerY = cfg.originPx.y + ref.row * cfg.cellSizePx
  const half = cfg.cellSizePx / 2
  return {
    x: cfg.pieceAnchor === 'center' ? cornerX + half : cornerX,
    y: cfg.pieceAnchor === 'center' ? cornerY + half : cornerY,
  }
}
