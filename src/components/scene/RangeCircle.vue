<script setup lang="ts">
import { computed } from 'vue'
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

const style = computed(() => {
  const p = centerPiece.value
  if (!p)
    return { display: 'none' as const }
  // p.widthCells / heightCells 来自 ccfolia,单位是 ccfolia 格;sword 一格 = 2 ccfolia 格,
  // 所以 ccfolia 一格 px = cellSize / 2。不要直接乘 settings.grid.cellSizePx(之前那样算会差一倍)。
  const ccfoliaCellPx = settings.grid.cellSizePx / 2
  const centerX = p.x + (p.widthCells * ccfoliaCellPx) / 2
  const centerY = p.y + (p.heightCells * ccfoliaCellPx) / 2
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
