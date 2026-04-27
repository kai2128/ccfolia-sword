import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { pxToCell } from '@/core/range/grid'
import { useSettingsStore } from '@/stores/settings'

// "画布上" = 三个条件同时成立:
//   1) ccfolia 把它当 piece 渲染(active=true + 有 x/y) —— 已被 pieces.list 过滤
//   2) 未被 GM 隐藏(invisible=false)
//   3) 坐标真实落在主板格网范围内 —— 有些 piece 被扔到画布外(x/y 超出 grid.cols/rows),
//      用 pxToCell() 返回 null 即视为"板外"。
// 依赖 settings.grid 校准正确,否则判定会错乱。
export function useOnCanvasIds() {
  const pieces = usePiecesStore()
  const settings = useSettingsStore()
  return computed(() => {
    const grid = settings.grid
    const ids = new Set<string>()
    for (const piece of pieces.list) {
      if (piece.invisible)
        continue
      if (pxToCell({ x: piece.x, y: piece.y }, grid) === null)
        continue
      ids.add(piece.characterId)
    }
    return ids
  })
}
