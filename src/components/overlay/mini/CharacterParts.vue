<script setup lang="ts">
// 多部位堆叠容器。设计稿里 CharacterParts 还会渲染怪物名,但我们的浮层是挂在
// ccfolia 棋子上、ccfolia 自己有原生角色名,这里只渲染 part rows,避免重复。
//
// variant:
//   E → 每行 PartInlinePill(默认)
//   C → 每行 MiniDiamondBar 加 label 前缀
//
// 部位破坏(hp.cur <= 0):不再渲染完整 pill/bar,改在栈底加一行紧凑的删除线名字
// 列表,信息密度高、视觉占位小。每个破坏部位仍可读出名字,但不再占满一行 HP/MP。
import { computed } from 'vue'
import MiniDiamondBar from './MiniDiamondBar.vue'
import PartInlinePill from './PartInlinePill.vue'

const props = defineProps<{
  parts: Array<{
    key: string
    label: string
    hp: { cur: number, max: number }
    mp?: { cur: number, max: number } | null
  }>
  variant: 'C' | 'E'
}>()

const aliveParts = computed(() => props.parts.filter(p => p.hp.cur > 0))
const brokenParts = computed(() => props.parts.filter(p => p.hp.cur <= 0))
</script>

<template>
  <div class="inline-flex flex-col items-start" :style="{ gap: '2px' }">
    <template v-for="p in aliveParts" :key="p.key">
      <PartInlinePill
        v-if="variant === 'E'"
        :label="p.label"
        :hp="p.hp"
        :mp="p.mp"
      />
      <MiniDiamondBar
        v-else
        :label="p.label"
        :hp="p.hp"
        :mp="p.mp"
      />
    </template>
    <div
      v-if="brokenParts.length > 0"
      class="inline-flex flex-wrap items-center font-serif"
      :style="{
        gap: '5px',
        padding: '0 2px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '.05em',
        color: '#8c5e5e',
        textShadow: '0 1px 1px #000',
        lineHeight: 1,
      }"
    >
      <span
        v-for="p in brokenParts"
        :key="p.key"
        :style="{ textDecoration: 'line-through' }"
      >{{ p.label || p.key }}</span>
    </div>
  </div>
</template>
