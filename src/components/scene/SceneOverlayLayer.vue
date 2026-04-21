<script setup lang="ts">
import { computed } from 'vue'
import { getCharacterFromElement } from '@/ccfolia/fiber-reader'
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
  // piece.x 实测是 .movable 的 canvas-local 左边(不是中心),所以 centerX 要 + offsetWidth/2。
  // piece.y 实测已经是立绘可见顶边的 canvas-local y,直接当 pill 锚点。
  centerX: number
  topY: number
  hp: { value: number, max: number } | null
}

// ccfolia 不同房间 cellSize 不同(实测 24 / 48 都见过),settings.grid.cellSizePx 默认 50
// 大概率对不上。直接从 .movable.offsetWidth 读真实 px,绕开配置校准。
function collectMovableSizes(): Map<string, number> {
  const out = new Map<string, number>()
  for (const el of document.querySelectorAll<HTMLElement>('.movable')) {
    const char = getCharacterFromElement(el)
    if (char?._id && el.offsetWidth > 0)
      out.set(char._id, el.offsetWidth)
  }
  return out
}

const entries = computed<OverlayEntry[]>(() => {
  const sizeMap = collectMovableSizes()
  return pieces.list
    .filter(p => !p.invisible && !p.hideStatus)
    .map((p) => {
      const char = chars.byId(p.characterId)
      const hp = char ? readStatusSlot(char.status, 'hp', settings.statusLabelMap) : null
      // DOM 里量到的直接用;没量到(时机问题)回落到 widthCells × settings.cellSize
      const widthPx = sizeMap.get(p.characterId) ?? p.widthCells * settings.grid.cellSizePx
      return {
        key: p.characterId,
        centerX: p.x + widthPx / 2,
        topY: p.y,
        hp,
      }
    })
})
</script>

<template>
  <div class="scene-overlay-layer">
    <div
      v-for="entry in entries"
      :key="entry.key"
      class="anchor"
      :style="{ transform: `translate3d(${entry.centerX}px, ${entry.topY}px, 0)` }"
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
