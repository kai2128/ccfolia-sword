<script setup lang="ts">
import { useRosterViewStore } from '@/stores/roster-view'

const view = useRosterViewStore()
</script>

<template>
  <div class="flex items-center gap-2 pb-1">
    <button
      type="button"
      class="h-6 flex items-center gap-1 border rounded px-2 text-xs transition-colors"
      :class="view.onCanvasOnly
        ? 'border-accent bg-accent/20 text-white'
        : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
      :title="view.onCanvasOnly ? '当前仅显示画布上的角色,点击关闭' : '仅显示画布上的角色'"
      @click="view.toggleOnCanvasOnly()"
    >
      <span class="i-lucide-map-pin text-3" />
      只看画布上
    </button>
  </div>
</template>
