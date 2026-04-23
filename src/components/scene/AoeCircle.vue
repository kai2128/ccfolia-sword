<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  buff: BuffInstance // attachedTo.kind === 'aoe'
}>()

const pieces = usePiecesStore()
const settings = useSettingsStore()

const centerPiece = computed(() => {
  const attach = props.buff.attachedTo
  if (attach.kind !== 'aoe')
    return null
  return pieces.list.find(p => p.characterId === attach.centerCharacterId) ?? null
})

// ccfolia 不同房间 cellSize 不同(settings.grid.cellSizePx 可能对不上实际渲染),
// 但 piece.x/y 和 cellSize 用的是同一套画布坐标,整体位置正确,直径按配置格数估算。
const diameterPx = computed(() => {
  if (props.buff.attachedTo.kind !== 'aoe')
    return 0
  return (2 * props.buff.attachedTo.radius + 1) * settings.grid.cellSizePx
})

const style = computed(() => {
  const p = centerPiece.value
  if (!p)
    return { display: 'none' as const }
  // piece.x/y 是立绘左上角,中心 = x + widthCells*cell/2;圆左上 = 中心 - diameter/2
  const cell = settings.grid.cellSizePx
  const centerX = p.x + (p.widthCells * cell) / 2
  const centerY = p.y + (p.heightCells * cell) / 2
  return {
    left: `${centerX - diameterPx.value / 2}px`,
    top: `${centerY - diameterPx.value / 2}px`,
    width: `${diameterPx.value}px`,
    height: `${diameterPx.value}px`,
    borderColor: props.buff.snapshot.color ?? 'rgba(90, 140, 255, 0.8)',
    opacity: props.buff.enabled ? 1 : 0.35,
  }
})
</script>

<template>
  <div class="aoe-circle" :style="style" />
</template>

<style scoped>
.aoe-circle {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(90, 140, 255, 0.8);
  background: rgba(90, 140, 255, 0.15);
  pointer-events: none;
  z-index: -1;
}
</style>
