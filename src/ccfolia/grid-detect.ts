import type { Pinia } from 'pinia'
import type { GridConfig } from '@/core/range/types'
import { createLogger } from '@/infra/log'
import { useSettingsStore } from '@/stores/settings'

const log = createLogger('grid-detect')

// 反编译源:src/containers/Screen/Screen/Field.tsx 画的根 div 就是我们要找的"场地"。
// 它的特征:
//   - style.position = 'absolute'
//   - style.backgroundSize 形如 "<cellSize>px <cellSize>px"(ccfolia 把网格画在 background 上)
//   - style.left / top / width / height 全走 inline style
// width/height 都是 cellSize 整倍,left/top 是 `~~(field/2) * -cellSize` —— 见 Field.tsx displaySize。
function findFieldElement(canvas: HTMLElement): HTMLElement | null {
  for (const child of Array.from(canvas.children)) {
    if (!(child instanceof HTMLElement))
      continue
    if (child.style.position !== 'absolute')
      continue
    const m = child.style.backgroundSize.match(/^([\d.]+)px\s+([\d.]+)px$/)
    if (!m)
      continue
    const cellW = Number.parseFloat(m[1])
    const cellH = Number.parseFloat(m[2])
    if (!Number.isFinite(cellW) || cellW <= 0 || cellW !== cellH)
      continue // 不接受非正方 / 非数值
    return child
  }
  return null
}

export function detectGridFromCanvas(canvas: HTMLElement): GridConfig | null {
  const field = findFieldElement(canvas)
  if (!field)
    return null
  const cellSizePx = Number.parseFloat(field.style.backgroundSize.split('px')[0])
  const left = Number.parseFloat(field.style.left) || 0
  const top = Number.parseFloat(field.style.top) || 0
  const width = Number.parseFloat(field.style.width) || 0
  const height = Number.parseFloat(field.style.height) || 0
  if (cellSizePx <= 0 || width <= 0 || height <= 0)
    return null
  return {
    originPx: { x: left, y: top },
    cellSizePx,
    cols: Math.round(width / cellSizePx),
    rows: Math.round(height / cellSizePx),
    // ccfolia Piece.tsx 实测 character.x/y 是立绘左上(DraggableItem initialPosition 直接用 char.x/cellSize,
    // 不做 center 偏移);SceneOverlayLayer 里"piece.x 实测是 .movable 的左边"也印证。
    pieceAnchor: 'top-left',
  }
}

function sameGrid(a: GridConfig, b: GridConfig): boolean {
  return a.cellSizePx === b.cellSizePx
    && a.cols === b.cols
    && a.rows === b.rows
    && a.originPx.x === b.originPx.x
    && a.originPx.y === b.originPx.y
    && a.pieceAnchor === b.pieceAnchor
}

// 被动校准:探到 Field 就把 settings.grid 同步过去,同值时短路跳过。
// 找不到(场景未就绪)返 false,让 caller 知道可以稍后再试。
export function autoCalibrateGrid(canvas: HTMLElement, pinia: Pinia): boolean {
  const detected = detectGridFromCanvas(canvas)
  if (!detected) {
    log.debug('auto-calibrate: Field div not found yet')
    return false
  }
  const settings = useSettingsStore(pinia)
  if (sameGrid(settings.grid, detected))
    return true
  settings.$patch({ grid: detected })
  log.info('grid auto-calibrated', detected)
  return true
}
