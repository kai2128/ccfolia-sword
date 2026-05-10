<script setup lang="ts">
// "克制 · 紧凑" status chip — 菱形宝石帽 + 中文 label + 金色数值格。
// 视觉契约对照 docs/superpowers/plans/status-chip/handoff/StatusChip.tsx 的 React 版本。
// 渲染保持 inline-flex,高度固定、宽度抱内容;放进 .hpmp-stack 后随 --mini-scale 同步缩放。
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  glyph: string
  hue: string
  polarity: 'buff' | 'debuff'
  value?: number
  height?: number
  dim?: boolean
}>(), {
  // 默认高度对齐 HP 指示器内部条状高度;chip 整体放进 .hpmp-stack 后还会再被 --mini-scale 缩。
  height: 10,
  dim: false,
})

const polarityRing = computed(() =>
  props.polarity === 'buff' ? 'rgba(110,210,150,.25)' : 'rgba(206,108,116,.25)',
)

// SVG <linearGradient id> 必须页面唯一,否则同页多 chip 会互相覆盖。
const gradId = computed(() => `sc-gem-${Math.random().toString(36).slice(2, 9)}`)

const labelPx = computed(() => Math.round(props.height * 0.56))
const valuePx = computed(() => Math.round(props.height * 0.55))
const glyphPx = computed(() => Math.round(props.height * 0.5))
const padLeft = computed(() => Math.max(4, props.height * 0.28))
const padRight = computed(() => Math.max(4, props.height * 0.32))
const valuePadX = computed(() => Math.max(5, props.height * 0.4))
</script>

<template>
  <div
    class="status-chip"
    :style="{
      height: `${height}px`,
      borderRadius: `${height * 0.5}px`,
      boxShadow: `0 1px 1.5px rgba(0,0,0,.5), inset 0 0 0 1px rgba(207,214,225,.45), inset 0 0 0 2px ${polarityRing}`,
      opacity: dim ? 0.45 : 1,
      filter: dim ? 'grayscale(.4)' : 'none',
    }"
  >
    <!-- 宝石帽 -->
    <div
      class="gem-cap"
      :style="{
        width: `${height}px`,
        height: `${height}px`,
        marginLeft: `${-height * 0.18}px`,
      }"
    >
      <svg
        :width="height * 1.05"
        :height="height * 1.05"
        viewBox="-1 -1 22 22"
        :style="{ overflow: 'visible', filter: `drop-shadow(0 0 3px ${hue}66)` }"
      >
        <defs>
          <linearGradient :id="gradId" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity=".9" />
            <stop offset=".4" :stop-color="hue" />
            <stop offset="1" :stop-color="hue" stop-opacity=".75" />
          </linearGradient>
        </defs>
        <path
          d="M 10 0 L 20 10 L 10 20 L 0 10 Z"
          :fill="`url(#${gradId})`"
          stroke="#cfd6e1"
          stroke-opacity=".7"
          stroke-width="1"
          stroke-linejoin="round"
        />
        <path d="M 10 3 L 14 10 L 10 6 L 6 10 Z" fill="#fff" opacity=".55" />
      </svg>
      <span
        class="gem-glyph"
        :style="{ fontSize: `${glyphPx}px` }"
      >{{ glyph }}</span>
    </div>

    <!-- Label -->
    <div
      class="chip-label"
      :style="{
        padding: `0 ${padRight}px 0 ${padLeft}px`,
        fontSize: `${labelPx}px`,
      }"
    >
      {{ label }}
    </div>

    <!-- Value cell -->
    <div
      v-if="value != null"
      class="value-cell"
      :style="{
        padding: `0 ${valuePadX}px 0 ${padRight}px`,
        borderTopRightRadius: `${height * 0.5}px`,
        borderBottomRightRadius: `${height * 0.5}px`,
        fontSize: `${valuePx}px`,
      }"
    >
      {{ value }}
    </div>
  </div>
</template>

<style scoped>
.status-chip {
  display: inline-flex;
  align-items: stretch;
  background: linear-gradient(180deg, #1a2240 0%, #06091a 100%);
  font-family: 'Noto Serif SC', serif;
  color: #f4ecd5;
  letter-spacing: 0.04em;
  position: relative;
}
.gem-cap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gem-glyph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #0b1224;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
  letter-spacing: 0;
}
.chip-label {
  display: flex;
  align-items: center;
  font-weight: 700;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.6);
}
.value-cell {
  display: flex;
  align-items: center;
  margin-left: auto;
  background: linear-gradient(180deg, rgba(231, 198, 106, 0.18), rgba(168, 122, 44, 0.32));
  border-left: 1px solid rgba(207, 214, 225, 0.35);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: #f7e7a8;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.7);
  letter-spacing: 0;
}
</style>
