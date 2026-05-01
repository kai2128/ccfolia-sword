import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { pieceBoxCenter, pxToCell } from '@/core/range'
import { useSettingsStore } from '@/stores/settings'

// "画布上" = 三个条件同时成立:
//   1) ccfolia 把它当 piece 渲染(active=true + 有 x/y) —— 已被 pieces.list 过滤
//   2) 未被 GM 隐藏(invisible=false)
//   3) box 中心(非左上角)落在主板格网内 —— 多格立绘 box 中心对齐 cell 中心后左上角会跨出原点,用左上角判会误判板外。
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
      if (pxToCell(pieceBoxCenter(piece, grid), grid) === null)
        continue
      ids.add(piece.characterId)
    }
    return ids
  })
}
