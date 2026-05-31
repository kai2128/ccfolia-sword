<script setup lang="ts">
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { pieceStandingCellCenter } from '@/core/range'
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

// 半径语义:"Nm" → 半径 N 格(1 格 = 1m,圆心锚在格心)。配合 aoe.ts 同一像素半径,可视圆严格包含所有被覆盖格的中心。
// r=3 时从格心向外 ½+1+1+½ = 3 格半径,触及第 3 格中心,直径 6 格。
const diameterPx = computed(() => 2 * props.radius * settings.grid.cellSizePx)

const style = computed(() => {
  const p = centerPiece.value
  if (!p)
    return { display: 'none' as const }
  // 圆心锚在站立格中心,与 Fx / AoE 距离判定一致。
  const center = pieceStandingCellCenter(p, settings.grid)
  return {
    left: `${center.x - diameterPx.value / 2}px`,
    top: `${center.y - diameterPx.value / 2}px`,
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
