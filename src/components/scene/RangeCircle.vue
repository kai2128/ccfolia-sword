<script setup lang="ts">
import { computed } from 'vue'
import { getCharacterFromElement } from '@/ccfolia/fiber-reader'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  characterId: string
  radius: number
}>()

const pieces = usePiecesStore()
const settings = useSettingsStore()

const centerPiece = computed(() =>
  pieces.list.find(p => p.characterId === props.characterId) ?? null,
)

// 直径语义:"Nm" → 直径 (2N-1) 格。配合 aoe.ts 的 `d < radius`,可视圆严格包含所有被覆盖格的中心。
// 即:r=1 仅自身 1 格,r=2 是 3×3 区域 3 格宽,r=3 是 5×5 区域 5 格宽。
const diameterPx = computed(() => (2 * props.radius - 1) * settings.grid.cellSizePx)

// 每个角色立绘有自己的渲染尺寸(widthCells×heightCells 各异,且 ccfolia 可能因图片缩放与公式偏差),
// 优先用 .movable.offsetWidth/Height 实测;读不到再回落到 widthCells × cellSizePx。
function measurePieceSize(charId: string): { width: number, height: number } | null {
  for (const el of document.querySelectorAll<HTMLElement>('.movable')) {
    const c = getCharacterFromElement(el)
    if (c?._id === charId && el.offsetWidth > 0)
      return { width: el.offsetWidth, height: el.offsetHeight }
  }
  return null
}

const style = computed(() => {
  const p = centerPiece.value
  if (!p)
    return { display: 'none' as const }
  const cellPx = settings.grid.cellSizePx
  const measured = measurePieceSize(props.characterId)
  const widthPx = measured?.width ?? p.widthCells * cellPx
  const heightPx = measured?.height ?? p.heightCells * cellPx
  const centerX = p.x + widthPx / 2
  const centerY = p.y + heightPx / 2
  return {
    left: `${centerX - diameterPx.value / 2}px`,
    top: `${centerY - diameterPx.value / 2}px`,
    width: `${diameterPx.value}px`,
    height: `${diameterPx.value}px`,
  }
})
</script>

<template>
  <div class="range-circle" :style="style">
    <span class="label">{{ radius }}m</span>
  </div>
</template>

<style scoped>
.range-circle {
  position: absolute;
  border-radius: 50%;
  border: 2px dashed rgba(80, 200, 200, 0.9);
  background: rgba(80, 200, 200, 0.08);
  pointer-events: none;
  display: grid;
  place-items: center;
  z-index: -1;
}
.label {
  color: rgba(80, 200, 200, 0.95);
  font-size: 12px;
  background: rgba(0, 0, 0, 0.5);
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1;
}
</style>
