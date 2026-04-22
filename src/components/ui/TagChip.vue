<script setup lang="ts">
import type { TagDefinition } from '@/types/tag'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  tag: TagDefinition
  size?: 'dot' | 'xs' | 'sm'
  variant?: 'solid' | 'outline'
  showIcon?: boolean
  clickable?: boolean
}>(), {
  size: 'sm',
  variant: 'solid',
  showIcon: true,
  clickable: false,
})

const sizeCls = computed(() => {
  switch (props.size) {
    case 'dot': return 'h-4 w-4 justify-center'
    case 'xs': return 'h-4 px-1.5 text-[10px]'
    case 'sm':
    default: return 'h-5 px-2 text-xs'
  }
})

const chipStyle = computed(() => {
  // dot 模式实心填色,图标白色,色差靠颜色而非文字
  if (props.size === 'dot') {
    return {
      backgroundColor: props.tag.color,
      color: '#fff',
    }
  }
  if (props.variant === 'solid') {
    return {
      backgroundColor: `${props.tag.color}33`,
      borderColor: `${props.tag.color}aa`,
      color: '#fff',
    }
  }
  return {
    borderColor: props.tag.color,
    color: props.tag.color,
  }
})

// dot 模式没图标时取 label 首字符作 fallback
const dotFallback = computed(() => props.tag.label?.[0] ?? '?')
</script>

<template>
  <span
    v-if="size === 'dot'"
    class="inline-flex items-center rounded-full text-[9px] font-bold leading-none"
    :class="[sizeCls, clickable && 'cursor-pointer hover:opacity-80']"
    :style="chipStyle"
    :title="tag.label"
  >
    <span v-if="showIcon && tag.icon" :class="tag.icon" class="text-3" />
    <span v-else>{{ dotFallback }}</span>
  </span>
  <span
    v-else
    class="inline-flex items-center gap-1 border rounded"
    :class="[sizeCls, clickable && 'cursor-pointer hover:opacity-80']"
    :style="chipStyle"
  >
    <span v-if="showIcon && tag.icon" :class="tag.icon" class="text-3" />
    <span class="whitespace-nowrap">{{ tag.label }}</span>
  </span>
</template>
