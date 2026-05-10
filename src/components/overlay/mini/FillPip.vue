<script setup lang="ts">
// 9×4 共享 pip。E (MiniInlinePill) 与 PartInlinePill 都用它做微型条:
// 既是颜色信号(HP/MP/danger),又是数量信号(fill 宽度 = ratio)。
// 颜色翻转(green↔red)瞬时,只对 width 做缓动 —— 保持「打到/治到立刻反应」的反馈感。
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  ratio?: number
  kind?: 'hp' | 'mp'
  danger?: boolean
}>(), {
  ratio: 1,
  kind: 'hp',
  danger: false,
})

const fill = computed(() => props.kind === 'mp' ? '#3a72c8' : (props.danger ? '#d04a4a' : '#3aa86a'))
const shine = computed(() => props.kind === 'mp' ? '#7eb3ff' : (props.danger ? '#ffb3b3' : '#b8f5c8'))
const widthPct = computed(() => `${Math.max(0, Math.min(1, props.ratio)) * 100}%`)
</script>

<template>
  <span
    class="relative shrink-0 overflow-hidden"
    :style="{
      width: '9px',
      height: '4px',
      background: 'rgba(6,9,26,.95)',
      border: '.5px solid rgba(207,214,225,.5)',
      borderRadius: '1.5px',
      boxShadow: `0 0 2px ${fill}88`,
    }"
  >
    <span
      class="absolute bottom-0 left-0 top-0"
      :style="{
        width: widthPct,
        background: `linear-gradient(180deg, ${shine} 0%, ${fill} 100%)`,
        transition: 'width var(--t-base, 240ms) var(--ease-out, cubic-bezier(.2,.7,.2,1))',
      }"
    />
  </span>
</template>
