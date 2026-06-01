<script setup lang="ts">
// 网格独立层根。挂在低 z(棋子之下)的 host 上,渲染 GridOverlay + AoeLayer,
// 这样网格落在背景之上、角色棋子之下;AOE 符文阵紧随其后(网格之上、棋子之下);
// HP/MP 条等仍在高 z 的 SceneOverlayRoot。
import AoeLayer from './AoeLayer.vue'
import GridOverlay from './GridOverlay.vue'
</script>

<template>
  <div class="ccs-grid-layer pointer-events-none absolute inset-0">
    <GridOverlay />
    <AoeLayer />
  </div>
</template>
