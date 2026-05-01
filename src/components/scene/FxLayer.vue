<script setup lang="ts">
import type { FxEvent } from '@/infra/fx-bus'
import { onMounted, onUnmounted, ref } from 'vue'
import { getCharacterFromElement } from '@/ccfolia/fiber-reader'
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

// 单帧内多目标(AOE)会突发 N 个事件,querySelectorAll + getCharacterFromElement
// 每次都全表扫太亏。一个 microtask 内复用同一份 charId→size 索引,刷新后再失效。
let movableSizeCache: Map<string, { width: number, height: number }> | null = null

function getMovableSizes(): Map<string, { width: number, height: number }> {
  if (movableSizeCache)
    return movableSizeCache
  const map = new Map<string, { width: number, height: number }>()
  for (const el of document.querySelectorAll<HTMLElement>('.movable')) {
    const c = getCharacterFromElement(el)
    if (c?._id && el.offsetWidth > 0)
      map.set(c._id, { width: el.offsetWidth, height: el.offsetHeight })
  }
  movableSizeCache = map
  queueMicrotask(() => {
    movableSizeCache = null
  })
  return map
}

function pieceCenter(charId: string): { x: number, y: number } | null {
  const p = pieces.byCharacterId(charId)
  if (!p)
    return null
  const measured = getMovableSizes().get(charId)
  // 回落:widthCells × cellSizePx(sword 一格 = ccfolia 一格)
  const fallbackCell = settings.grid.cellSizePx
  const widthPx = measured?.width ?? p.widthCells * fallbackCell
  const heightPx = measured?.height ?? p.heightCells * fallbackCell
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
