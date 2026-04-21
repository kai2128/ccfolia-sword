<script setup lang="ts">
// 本 plan 只挂个空容器,HpIndicator / BuffBadgeRow 在 Plan 03 / 05 填内容。
// 这里多做一件事:把 overlay 侧拿到的 pieces-store 暴露出去,方便验收两边是不是同一实例。
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'

const pieces = usePiecesStore()
const roomCharacters = useRoomCharactersStore()

const dbg = window as unknown as { __CCS_STORES__?: Record<string, unknown> }
dbg.__CCS_STORES__ = {
  ...(dbg.__CCS_STORES__ ?? {}),
  overlayPieces: pieces,
  overlayRoomCharacters: roomCharacters,
}
</script>

<template>
  <div class="ccs-scene-overlay" />
</template>

<style scoped>
.ccs-scene-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
