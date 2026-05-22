<script setup lang="ts">
// 网格独立层根。挂在低 z(棋子之下)的 host 上,只渲染 GridOverlay,
// 这样网格落在背景之上、角色棋子之下;HP/MP 条等仍在高 z 的 SceneOverlayRoot。
import GridOverlay from './GridOverlay.vue'
</script>

<template>
  <div class="ccs-grid-layer pointer-events-none absolute inset-0">
    <GridOverlay />
  </div>
</template>
