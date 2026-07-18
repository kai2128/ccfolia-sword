<script setup lang="ts">
// 满宽细 fill 条。E (MiniInlinePill) 与 PartInlinePill 共用:数值在上,fill 条在下。
// 颜色瞬时翻转,只对 width 缓动 —— 保持「打到/治到立刻反应」的反馈感。
import { computed } from 'vue'
import { hpTier } from './hp-tier'

const props = withDefaults(defineProps<{
  ratio?: number
  kind?: 'hp' | 'mp'
  danger?: boolean
  height?: number
}>(), {
  ratio: 1,
  kind: 'hp',
  danger: false,
  height: 2.5,
})

// MP 恒蓝;HP 走共用分档。
const tier = computed(() => props.kind === 'mp'
  ? { fill: '#3a72c8', shine: '#7eb3ff' }
  : hpTier(props.ratio, props.danger))
const fill = computed(() => tier.value.fill)
const shine = computed(() => tier.value.shine)
const widthPct = computed(() => `${Math.max(0, Math.min(1, props.ratio)) * 100}%`)
</script>

<template>
  <span
    class="pointer-events-none relative block overflow-hidden"
    :style="{
      height: `${height}px`,
      background: 'rgba(6,9,26,.9)',
      borderRadius: '1.5px',
    }"
  >
    <!-- max shade — 满宽的填充色淡影,标出 max 轨道 -->
    <span class="absolute inset-0" :style="{ background: fill, opacity: 0.22 }" />
    <span
      class="absolute bottom-0 left-0 top-0"
      :style="{
        width: widthPct,
        background: `linear-gradient(90deg, ${fill}, ${shine})`,
        boxShadow: `0 0 2px ${fill}`,
        transition: 'width var(--t-base, 240ms) var(--ease-out, cubic-bezier(.2,.7,.2,1))',
      }"
    />
  </span>
</template>
