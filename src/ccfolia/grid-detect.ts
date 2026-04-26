import type { GridConfig } from '@/core/range/types'

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
  const ccfoliaCellSize = Number.parseFloat(field.style.backgroundSize.split('px')[0])
  const left = Number.parseFloat(field.style.left) || 0
  const top = Number.parseFloat(field.style.top) || 0
  const width = Number.parseFloat(field.style.width) || 0
  const height = Number.parseFloat(field.style.height) || 0
  if (ccfoliaCellSize <= 0 || width <= 0 || height <= 0)
    return null
  // sword 一格 = ccfolia 两格(cellSize * 2 = 48px)。这样在 SW2.5 标准 19×34 逻辑棋盘下,
  // 用户需要把 ccfolia 房间的 fieldWidth/Height 设为 38×68,校准就能映射到 19×34。
  const cellSizePx = ccfoliaCellSize * 2
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
