<script setup lang="ts">
import type { FxEvent } from '@/infra/fx-bus'
import { onMounted, onUnmounted, ref } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { pieceStandingCellCenter } from '@/core/range'
import { onFx } from '@/infra/fx-bus'
import { useSettingsStore } from '@/stores/settings'
import FxHeal from './FxHeal.vue'
import FxMpDelta from './FxMpDelta.vue'
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
  // 浮字从站立格中心升起,与 range / AoE 一致。
  return pieceStandingCellCenter(p, settings.grid)
}

// slash ~1100ms(浮字),heal 去掉粒子后 ~1300ms,多给一点尾防 forwards 末态被剪。
// MP 浮字 1000ms,留点尾到 1200。
const TTL_MS: Record<FxEvent['kind'], number> = {
  'damage': 1200,
  'heal': 1400,
  'mp-drain': 1200,
  'mp-restore': 1200,
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
      <FxHeal v-else-if="item.kind === 'heal'" :x="item.x" :y="item.y" :amount="item.amount" />
      <FxMpDelta
        v-else
        :x="item.x"
        :y="item.y"
        :amount="item.amount"
        :gain="item.kind === 'mp-restore'"
      />
    </template>
  </div>
</template>
