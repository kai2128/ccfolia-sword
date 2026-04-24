<script setup lang="ts">
// 画布上的格网校准叠加层。仅在 settings.gridOverlayVisible=true 时渲染。
// 坐标系与 SceneOverlayLayer 一致(绝对定位到 ccfolia canvas 原点),用 translate
// 把 SVG 整体平移到 originPx,线段从 (0,0) 起画到 cols*cellSize × rows*cellSize。
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

const grid = computed(() => settings.grid)
const totalW = computed(() => grid.value.cols * grid.value.cellSizePx)
const totalH = computed(() => grid.value.rows * grid.value.cellSizePx)

const vLines = computed(() => {
  const { cols, cellSizePx } = grid.value
  return Array.from({ length: cols + 1 }, (_, i) => i * cellSizePx)
})
const hLines = computed(() => {
  const { rows, cellSizePx } = grid.value
  return Array.from({ length: rows + 1 }, (_, i) => i * cellSizePx)
})

const svgStyle = computed(() => ({
  transform: `translate(${grid.value.originPx.x}px, ${grid.value.originPx.y}px)`,
}))
</script>

<template>
  <svg
    v-if="settings.gridOverlayVisible"
    class="pointer-events-none absolute left-0 top-0"
    :width="totalW"
    :height="totalH"
    :style="svgStyle"
    shape-rendering="crispEdges"
  >
    <line
      v-for="x in vLines"
      :key="`v-${x}`"
      :x1="x"
      :y1="0"
      :x2="x"
      :y2="totalH"
      stroke="rgba(255,255,255,0.25)"
      stroke-width="1"
    />
    <line
      v-for="y in hLines"
      :key="`h-${y}`"
      :x1="0"
      :y1="y"
      :x2="totalW"
      :y2="y"
      stroke="rgba(255,255,255,0.25)"
      stroke-width="1"
    />
  </svg>
</template>
