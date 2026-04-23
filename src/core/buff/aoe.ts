import type { PieceSnapshot } from '@/ccfolia/pieces-store'
import type { GridConfig } from '@/core/range/types'
import type { BuffInstance } from '@/types/buff-v3'
import { chebyshev, pxToCell } from '@/core/range'

// piece.x/y 是立绘左上(ccfolia Piece.tsx + grid-detect 注释),多格立绘的"中心"应取 bbox 几何中心。
// 和 AoeCircle.vue / RangeCircle.vue 的绘制口径保持一致,否则 2x2+ piece 的覆盖与可视圈会错位。
function pieceCenterCell(p: PieceSnapshot, grid: GridConfig) {
  const cx = p.x + (p.widthCells * grid.cellSizePx) / 2
  const cy = p.y + (p.heightCells * grid.cellSizePx) / 2
  return pxToCell({ x: cx, y: cy }, grid)
}

// 输入:AoE buff + 当前所有 pieces + grid 配置
// 输出:被覆盖的 characterId 集合(含中心自身)
// 规则:auto = 距离中心 ≤ radius 的 piece;final = (auto ∪ include) \ exclude
// 注:本函数不看 enabled,enabled=false 时 UI 层自己决定灰显;这样中心死亡后仍能显示"原本谁被罩着"
export function computeCoverage(
  buff: BuffInstance,
  pieces: PieceSnapshot[],
  grid: GridConfig,
): Set<string> {
  if (buff.attachedTo.kind !== 'aoe')
    return new Set()
  const attach = buff.attachedTo
  const center = pieces.find(p => p.characterId === attach.centerCharacterId)
  if (!center)
    return new Set()
  const centerCell = pieceCenterCell(center, grid)
  if (!centerCell)
    return new Set()

  const auto = new Set<string>()
  for (const p of pieces) {
    const cell = pieceCenterCell(p, grid)
    if (!cell)
      continue
    const d = chebyshev(centerCell, cell)
    if (d <= attach.radius)
      auto.add(p.characterId)
  }

  const include = new Set(attach.includeOverride ?? [])
  const exclude = new Set(attach.excludeOverride ?? [])

  const out = new Set<string>()
  for (const id of auto)
    out.add(id)
  for (const id of include)
    out.add(id)
  for (const id of exclude)
    out.delete(id)
  return out
}
