<script setup lang="ts">
// 本 plan 只挂个空容器,HpIndicator / BuffBadgeRow 在 Plan 03 / 05 填内容。
// 这里多做一件事:把 overlay 侧拿到的 pieces-store 暴露出去,方便验收两边是不是同一实例。
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import FxLayer from './FxLayer.vue'
import RulerLayer from './RulerLayer.vue'
import SceneOverlayLayer from './SceneOverlayLayer.vue'

declare const unsafeWindow: Window & typeof globalThis

const pieces = usePiecesStore()
const roomCharacters = useRoomCharactersStore()

try {
  const dbg = unsafeWindow as unknown as { __CCS_STORES__?: Record<string, unknown> }
  dbg.__CCS_STORES__ = {
    ...(dbg.__CCS_STORES__ ?? {}),
    overlayPieces: pieces,
    overlayRoomCharacters: roomCharacters,
  }
}
catch { /* ignore */ }
</script>

<template>
  <div class="ccs-scene-overlay">
    <SceneOverlayLayer />
    <FxLayer />
    <RulerLayer />
  </div>
</template>

<style scoped>
.ccs-scene-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
