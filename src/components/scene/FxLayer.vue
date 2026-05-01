<script setup lang="ts">
import type { FxEvent } from '@/infra/fx-bus'
import { onMounted, onUnmounted, ref } from 'vue'
import { getMovableSizes } from '@/ccfolia/movable-size'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { onFx } from '@/infra/fx-bus'
import { useSettingsStore } from '@/stores/settings'
import FxHeal from './FxHeal.vue'
import FxSplash from './FxSplash.vue'

interface FxItem {
  id: number
  kind: FxEvent['kind']
  x: number
  y: number
  amount: number
}

const pieces = usePiecesStore()
const settings = useSettingsStore()
const items = ref<FxItem[]>([])
let nextId = 1

function pieceCenter(charId: string): { x: number, y: number } | null {
  const p = pieces.byCharacterId(charId)
  if (!p)
    return null
  const measured = getMovableSizes().get(charId)
  const cellPx = settings.grid.cellSizePx
  const widthPx = measured?.width ?? p.widthCells * cellPx
  const heightPx = measured?.height ?? p.heightCells * cellPx
  return { x: p.x + widthPx / 2, y: p.y + heightPx / 2 }
}

// slash ~1100ms(浮字),heal 去掉粒子后 ~1300ms,多给一点尾防 forwards 末态被剪。
const TTL_MS: Record<FxEvent['kind'], number> = {
  damage: 1200,
  heal: 1400,
}

let off: (() => void) | null = null

onMounted(() => {
  off = onFx((event) => {
    const center = pieceCenter(event.charId)
    if (!center)
      return
    const id = nextId++
    items.value.push({ id, kind: event.kind, x: center.x, y: center.y, amount: event.amount })
    setTimeout(() => {
      items.value = items.value.filter(i => i.id !== id)
    }, TTL_MS[event.kind])
  })
})

onUnmounted(() => {
  off?.()
})
</script>

<template>
  <div class="pointer-events-none absolute inset-0">
    <template v-for="item in items" :key="item.id">
      <FxSplash v-if="item.kind === 'damage'" :x="item.x" :y="item.y" :damage="item.amount" />
      <FxHeal v-else :x="item.x" :y="item.y" :amount="item.amount" />
    </template>
  </div>
</template>
