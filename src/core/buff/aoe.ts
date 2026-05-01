import type { PieceSnapshot } from '@/ccfolia/pieces-store'
import type { GridConfig } from '@/core/range/types'
import type { BuffInstance } from '@/types/buff-v3'
import { pieceStandingCellCenter, pxToCell } from '@/core/range'

// 输入:AoE buff + 当前所有 pieces + grid 配置
// 输出:被覆盖的 characterId 集合(含中心自身)
// 规则:auto = piece 中心的欧氏距离 ≤ 可视圆的像素半径;final = (auto ∪ include) \ exclude
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
  const centerPx = pieceStandingCellCenter(center, grid)
  if (!pxToCell(centerPx, grid))
    return new Set() // 中心 piece 不在格网内,覆盖无意义

  // "Nm" 可视圆直径 = (2N-1) 格 → 像素半径 = (2N-1) * cellSize / 2。
  // 用欧氏距离严格匹配圆内,Chebyshev 2√2 那种对角角落格视觉上在圆外就不算覆盖。
  const pxRadius = ((2 * attach.radius - 1) * grid.cellSizePx) / 2
  const pxRadiusSq = pxRadius * pxRadius
  const auto = new Set<string>()
  for (const p of pieces) {
    const pxTarget = pieceStandingCellCenter(p, grid)
    if (!pxToCell(pxTarget, grid))
      continue // 脱离格网的 piece 不算(保留之前 off-grid 行为)
    const dx = pxTarget.x - centerPx.x
    const dy = pxTarget.y - centerPx.y
    if (dx * dx + dy * dy <= pxRadiusSq)
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
