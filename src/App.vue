<script setup lang="ts">
// Phase 1 最小验证:UnoCSS 原子类 + lucide/mdi 图标是否在 Shadow DOM 内正常出样式
</script>

<template>
  <div class="fixed bottom-4 right-4 w-60 flex flex-col gap-2 card">
    <div class="flex items-center gap-2">
      <div class="i-lucide-sword text-5 text-hp" />
      <span class="text-sm font-medium">ccfolia-sword</span>
      <span class="ml-auto text-xs opacity-60">Phase 1</span>
    </div>
    <div class="flex gap-1">
      <div class="chip bg-buff/20 text-buff">
        <div class="i-mdi-shield" />
        <span>Buff</span>
      </div>
      <div class="chip bg-debuff/20 text-debuff">
        <div class="i-mdi-skull-outline" />
        <span>Debuff</span>
      </div>
    </div>
  </div>
</template>
