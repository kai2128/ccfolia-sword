<script setup lang="ts">
// 独立定位在视口右下角,不复用 panelPos。
// 之所以不 reuse panelPos:panelPos 是面板左上角(面板 320×360),小 icon 挂那里
// 视觉上离角落好远;展开时面板从 panelPos 弹出,不跳动即可。
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <button
    class="ccs-launcher"
    title="Open sword panel (Alt+S)"
    @click="settings.showPanel()"
  >
    <div class="i-lucide-sword ccs-launcher-icon" />
  </button>
</template>

<style scoped>
.ccs-launcher {
  position: fixed;
  left: 16px;
  bottom: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(20, 20, 24, 0.85);
  color: #eee;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  z-index: 9998;
}
.ccs-launcher:hover {
  background: rgba(40, 40, 48, 0.95);
}
.ccs-launcher-icon {
  width: 18px;
  height: 18px;
}
</style>
