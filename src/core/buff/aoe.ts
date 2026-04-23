import type { PieceSnapshot } from '@/ccfolia/pieces-store'
import type { GridConfig } from '@/core/range/types'
import type { BuffInstance } from '@/types/buff-v3'
import { chebyshev, pxToCell } from '@/core/range'

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
  const centerCell = pxToCell({ x: center.x, y: center.y }, grid)
  if (!centerCell)
    return new Set()

  const auto = new Set<string>()
  for (const p of pieces) {
    const cell = pxToCell({ x: p.x, y: p.y }, grid)
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
