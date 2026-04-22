<script setup lang="ts">
import type { TagDefinition } from '@/types/tag'

defineProps<{
  location: 'on-canvas' | 'off-canvas'
  primaryTag: TagDefinition | null
  count: number
}>()
</script>

<template>
  <div class="flex items-center gap-2 border-b border-white/10 pb-0.5 first:mt-0 mt-2!">
    <span
      v-if="primaryTag" class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
      :style="{ backgroundColor: `${primaryTag.color}33`, color: '#fff' }"
    >
      <span v-if="primaryTag.icon" :class="primaryTag.icon" class="text-3" />
      {{ primaryTag.label }}
    </span>
    <span v-else class="text-xs text-white/40">未分类</span>
    <span class="text-[11px] text-white/40">· {{ count }}</span>
    <span v-if="location === 'on-canvas'" class="i-lucide-map-pin text-3.5 text-accent -py-1" title="在画布上" />
  </div>
</template>
