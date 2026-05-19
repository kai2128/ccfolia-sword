<script setup lang="ts">
import SessionTimer from '@/components/scene/SessionTimer.vue'
import TurnIndicator from '@/components/scene/TurnIndicator.vue'
// 单一职责:挂 PanelShell + 全屏浮窗 TurnIndicator / SessionTimer。
// 这些 fixed 浮窗必须挂在主 app(`ccs-host` 在 body 上,无 transform 祖先),
// 不能挂在 scene overlay —— 那里 ccfolia canvas 有 transform: scale,
// position: fixed 会被 containing-block 提升劫持,效果失效。
import PanelShell from '@/components/shell/PanelShell.vue'
import { useUndoHotkey } from '@/composables/useUndoHotkey'

// 全局 Ctrl+` / Ctrl+Shift+`(redo)。让出 Ctrl/Cmd+Z 给 ccfolia 原生 undo。
useUndoHotkey()
</script>

<template>
  <PanelShell />
  <TurnIndicator />
  <SessionTimer />
</template>
