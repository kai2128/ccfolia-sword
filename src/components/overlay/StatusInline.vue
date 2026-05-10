<script setup lang="ts">
// 拥挤模式下的紧凑形态:仅渲染宝石 + 字 + 右下角小数字。
// 没有 overflow 处理 —— 拥挤场景下 status 数量通常 ≤ 3。

withDefaults(defineProps<{
  items: Array<{
    label: string
    glyph: string
    hue: string
    polarity: 'buff' | 'debuff'
    value?: number
    dim?: boolean
  }>
  size?: number
}>(), {
  size: 10,
})
</script>

<template>
  <span class="status-inline" :style="{ gap: `${size * 0.7}px` }">
    <span
      v-for="(it, i) in items"
      :key="`${i}-${it.label}`"
      class="status-inline-item"
      :title="it.label"
      :style="{ width: `${size}px`, height: `${size}px`, opacity: it.dim ? 0.4 : 1 }"
    >
      <svg
        :width="size"
        :height="size"
        viewBox="-1 -1 22 22"
        :style="{ overflow: 'visible', filter: `drop-shadow(0 0 2px ${it.hue}aa)` }"
      >
        <path
          d="M 10 0 L 20 10 L 10 20 L 0 10 Z"
          :fill="it.hue"
          stroke="#cfd6e1"
          stroke-opacity=".6"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
      </svg>
      <span
        class="inline-glyph"
        :style="{ fontSize: `${Math.round(size * 0.45)}px` }"
      >{{ it.glyph }}</span>
      <span
        v-if="it.value != null"
        class="inline-badge"
        :style="{
          minWidth: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.round(size * 0.8)}px`,
          right: `${-size * 0.45}px`,
          bottom: `${-size * 0.35}px`,
        }"
      >{{ it.value }}</span>
    </span>
  </span>
</template>

<style scoped>
.status-inline {
  display: inline-flex;
  align-items: center;
}
.status-inline-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.inline-glyph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Serif SC', serif;
  font-weight: 700;
  color: #0b1224;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
  letter-spacing: 0;
}
.inline-badge {
  position: absolute;
  border-radius: 999px;
  padding: 0 3px;
  background: #0b1224;
  color: #f7e7a8;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px #cfd6e1;
  letter-spacing: 0;
}
</style>
