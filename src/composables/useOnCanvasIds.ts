import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { pxToCell } from '@/core/range/grid'
import { useSettingsStore } from '@/stores/settings'

// "画布上" = 三个条件同时成立:
//   1) ccfolia 把它当 piece 渲染(active=true + 有 x/y) —— 已被 pieces.list 过滤
//   2) 未被 GM 隐藏(invisible=false)
//   3) 坐标真实落在主板格网范围内 —— 用 piece box 几何中心(p.x/y 是左上角)而非左上角判定,
//      和 setCharacterCell / moveCharacterByCells 的"box 中心对齐 cell 中心"语义保持一致。
//      多格立绘(box 中心在 cell 中心,左上角会跨出原点)用左上角判会被误判板外。
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
      const boxCenter = {
        x: piece.x + (piece.widthCells * grid.cellSizePx) / 2,
        y: piece.y + (piece.heightCells * grid.cellSizePx) / 2,
      }
      if (pxToCell(boxCenter, grid) === null)
        continue
      ids.add(piece.characterId)
    }
    return ids
  })
}
