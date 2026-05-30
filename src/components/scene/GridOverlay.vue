<script setup lang="ts">
// 画布上的格网校准叠加层。仅在 settings.gridOverlayVisible=true 时渲染。
// 坐标系与 SceneOverlayLayer 一致(绝对定位到 ccfolia canvas 原点),用 translate
// 把 SVG 整体平移到 originPx,线段从 (0,0) 起画到 cols*cellSize × rows*cellSize。
// 由 GridLayerRoot 挂在低 z(棋子之下)的独立 host,所以网格落在背景之上、角色之下。
import { computed } from 'vue'
import { formatCol, formatRow } from '@/core/range'
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

// 每格两个标签:左上角列字母、右下角行号。坐标都是世界单位(随 Scaler 缩放)。
const labelPad = computed(() => grid.value.cellSizePx * 0.08)
const labelFontSize = computed(() => grid.value.cellSizePx * 0.24)

const cells = computed(() => {
  const { cols, rows, cellSizePx } = grid.value
  const pad = labelPad.value
  const out: {
    key: string
    col: string
    row: string
    colX: number
    colY: number
    rowX: number
    rowY: number
  }[] = []
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      out.push({
        key: `${c}-${r}`,
        col: formatCol(c),
        row: formatRow(r),
        colX: c * cellSizePx + pad,
        colY: r * cellSizePx + pad,
        rowX: (c + 1) * cellSizePx - pad,
        rowY: (r + 1) * cellSizePx - pad,
      })
    }
  }
  return out
})

const svgStyle = computed(() => ({
  transform: `translate(${grid.value.originPx.x}px, ${grid.value.originPx.y}px)`,
  opacity: settings.gridOpacity,
}))

// 线条与标签共用同一颜色,跟随 settings.gridColor(white / black)。
const strokeColor = computed(() => settings.gridColor)
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
      :stroke="strokeColor"
      stroke-width="1"
    />
    <line
      v-for="y in hLines"
      :key="`h-${y}`"
      :x1="0"
      :y1="y"
      :x2="totalW"
      :y2="y"
      :stroke="strokeColor"
      stroke-width="1"
    />
    <g
      v-if="settings.gridLabelsVisible"
      :fill="strokeColor"
      font-family="Cinzel, 'Noto Serif SC', serif"
      font-weight="400"
    >
      <template v-for="cell in cells" :key="cell.key">
        <text
          :x="cell.colX"
          :y="cell.colY"
          :font-size="labelFontSize"
          text-anchor="start"
          dominant-baseline="hanging"
        >
          {{ cell.col }}
        </text>
        <text
          :x="cell.rowX"
          :y="cell.rowY"
          :font-size="labelFontSize"
          text-anchor="end"
          dominant-baseline="alphabetic"
        >
          {{ cell.row }}
        </text>
      </template>
    </g>
  </svg>
</template>
