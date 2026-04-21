<script setup lang="ts">
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import HpIndicator from '@/components/overlay/HpIndicator.vue'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'

const pieces = usePiecesStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()

interface OverlayEntry {
  key: string
  x: number
  y: number
  hp: { value: number, max: number } | null
}

// 可见性规则:invisible / hideStatus 命中任一就不渲染 pill,与 ccfolia 原生遮蔽对齐。
const entries = computed<OverlayEntry[]>(() =>
  pieces.list
    .filter(p => !p.invisible && !p.hideStatus)
    .map((p) => {
      const char = chars.byId(p.characterId)
      const hp = char ? readStatusSlot(char.status, 'hp', settings.statusLabelMap) : null
      return { key: p.characterId, x: p.x, y: p.y, hp }
    }),
)
</script>

<template>
  <div class="scene-overlay-layer">
    <div
      v-for="entry in entries"
      :key="entry.key"
      class="anchor"
      :style="{ transform: `translate3d(${entry.x}px, ${entry.y}px, 0)` }"
    >
      <div class="hp-slot">
        <HpIndicator v-if="entry.hp" :current="entry.hp.value" :max="entry.hp.max" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.anchor {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}
.hp-slot {
  transform: translate(-50%, -110%);
}
</style>
