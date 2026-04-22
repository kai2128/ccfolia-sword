<script setup lang="ts">
import type { TagDefinition } from '@/types/tag'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  tag: TagDefinition
  size?: 'sm' | 'xs'
  variant?: 'solid' | 'outline'
  showIcon?: boolean
  clickable?: boolean
}>(), {
  size: 'sm',
  variant: 'solid',
  showIcon: true,
  clickable: false,
})

const sizeCls = computed(() => props.size === 'xs' ? 'h-4 px-1.5 text-[10px]' : 'h-5 px-2 text-xs')

const chipStyle = computed(() => {
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
</script>

<template>
  <span
    class="inline-flex items-center gap-1 border rounded"
    :class="[sizeCls, clickable && 'cursor-pointer hover:opacity-80']"
    :style="chipStyle"
  >
    <span v-if="showIcon && tag.icon" :class="tag.icon" class="text-3" />
    <span class="whitespace-nowrap">{{ tag.label }}</span>
  </span>
</template>
