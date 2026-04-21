<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <button
    class="ccs-launcher"
    :style="{ left: `${settings.panelPos.x}px`, top: `${settings.panelPos.y}px` }"
    title="Open sword panel (Alt+S)"
    @click="settings.showPanel()"
  >
    ⚔
  </button>
</template>

<style scoped>
.ccs-launcher {
  position: fixed;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(20, 20, 24, 0.85);
  color: #eee;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  z-index: 9998;
}
.ccs-launcher:hover {
  background: rgba(40, 40, 48, 0.95);
}
</style>
