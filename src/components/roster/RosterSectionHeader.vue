<script setup lang="ts">
import type { TagDefinition } from '@/types/tag'

defineProps<{
  location: 'on-canvas' | 'off-canvas'
  primaryTag: TagDefinition | null
  count: number
}>()

const locationLabel: Record<'on-canvas' | 'off-canvas', string> = {
  'on-canvas': '画布上',
  'off-canvas': '画布外',
}
</script>

<template>
  <div class="mt-3 flex items-center gap-2 border-b border-white/10 pb-1 first:mt-0">
    <span class="text-[11px] text-white/40 uppercase">{{ locationLabel[location] }}</span>
    <span
      v-if="primaryTag"
      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
      :style="{ backgroundColor: `${primaryTag.color}33`, color: '#fff' }"
    >
      <span v-if="primaryTag.icon" :class="primaryTag.icon" class="text-3" />
      {{ primaryTag.label }}
    </span>
    <span v-else class="text-xs text-white/40">未分类</span>
    <span class="text-[11px] text-white/40">· {{ count }}</span>
  </div>
</template>
