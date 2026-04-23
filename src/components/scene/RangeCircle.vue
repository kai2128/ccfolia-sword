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

const diameterPx = computed(() => (2 * props.radius + 1) * settings.grid.cellSizePx)

const style = computed(() => {
  const p = centerPiece.value
  if (!p)
    return { display: 'none' as const }
  const cell = settings.grid.cellSizePx
  const centerX = p.x + (p.widthCells * cell) / 2
  const centerY = p.y + (p.heightCells * cell) / 2
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
