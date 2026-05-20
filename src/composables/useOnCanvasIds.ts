import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { pieceBottomCenter, pxToCell } from '@/core/range'
import { useSettingsStore } from '@/stores/settings'

// 脚下锚点落在 cell 底边时,需要略微回到格内侧,否则被 floor 推到下一格。
const CELL_BOUNDARY_EPS = 0.001

// "场上" = 三个条件同时成立:
//   1) ccfolia 把它当 piece 渲染(active=true + 有 x/y) —— 已被 pieces.list 过滤
//   2) 未被 GM 隐藏(invisible=false)
//   3) piece 底边中点(脚下)落在主板格网内 —— 和 setCharacterCell / moveCharacterByCells 锚点口径一致。
// 依赖 settings.grid 校准正确,否则判定会错乱。
//
// 单例:5 个组件(RosterList / RosterSelectionBar / BatchApplySheet / MovePanel / TargetQuickPicker)
// 共用。之前每处各建一个 computed,拖动时每帧各自遍历全部 pieces;共享后一帧只算一次。
let shared: ComputedRef<Set<string>> | null = null

export function useOnCanvasIds() {
  if (shared)
    return shared
  const pieces = usePiecesStore()
  const settings = useSettingsStore()
  shared = computed(() => {
    const grid = settings.grid
    const ids = new Set<string>()
    for (const piece of pieces.list) {
      if (piece.invisible)
        continue
      const bottomCenter = pieceBottomCenter(piece, grid)
      if (pxToCell({ x: bottomCenter.x, y: bottomCenter.y - CELL_BOUNDARY_EPS }, grid) === null)
        continue
      ids.add(piece.characterId)
    }
    return ids
  })
  return shared
}
