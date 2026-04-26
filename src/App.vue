<script setup lang="ts">
// 单一职责:挂 PanelShell + 全屏浮窗 TurnIndicator。
// TurnIndicator 必须挂在主 app(`ccs-host` 在 body 上,无 transform 祖先),
// 不能挂在 scene overlay —— 那里 ccfolia canvas 有 transform: scale,
// position: fixed 会被 containing-block 提升劫持,效果失效。
import PanelShell from '@/components/shell/PanelShell.vue'
import TurnIndicator from '@/components/scene/TurnIndicator.vue'
</script>

<template>
  <PanelShell />
  <TurnIndicator />
</template>
