<script setup lang="ts">
import type { FxEvent } from '@/infra/fx-bus'
// FX 队列层:订阅 fx-bus,按事件查 piece 坐标,挂载 FxSplash / FxHeal,
// 并在动画收尾时把 item 从队列里清掉(组件本身没有自卸载逻辑)。
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

// 跟 SceneOverlayLayer.collectMovableSizes 同源:从 .movable.offsetWidth/Height
// 直接读 DOM 真实尺寸,绕开 grid.cellSizePx 校准误差。
function pieceCenter(charId: string): { x: number, y: number } | null {
  const p = pieces.byCharacterId(charId)
  if (!p)
    return null
  // 回落:校准格 px 的一半(ccfolia 一格 = sword 一格的 1/2)
  const fallbackCell = settings.grid.cellSizePx / 2
  let widthPx = p.widthCells * fallbackCell
  let heightPx = p.heightCells * fallbackCell
  for (const el of document.querySelectorAll<HTMLElement>('.movable')) {
    const c = getCharacterFromElement(el)
    if (c?._id === charId && el.offsetWidth > 0) {
      widthPx = el.offsetWidth
      heightPx = el.offsetHeight
      break
    }
  }
  return { x: p.x + widthPx / 2, y: p.y + heightPx / 2 }
}

// 组件最长动画:slash ~1100ms(浮字),heal 在去掉粒子后由 healBloom(900ms) +
// floatDamage(1100ms)收尾,1300ms 足够。多给一点尾以免 forwards 末态闪掉。
const TTL_MS: Record<FxEvent['kind'], number> = {
  damage: 1200,
  heal: 1400,
}

let off: (() => void) | null = null
const timers = new Set<ReturnType<typeof setTimeout>>()

onMounted(() => {
  off = onFx((event) => {
    const center = pieceCenter(event.charId)
    if (!center)
      return
    const id = nextId++
    items.value.push({ id, kind: event.kind, x: center.x, y: center.y, amount: event.amount })
    const timer = setTimeout(() => {
      items.value = items.value.filter(i => i.id !== id)
      timers.delete(timer)
    }, TTL_MS[event.kind])
    timers.add(timer)
  })
})

onUnmounted(() => {
  off?.()
  for (const t of timers)
    clearTimeout(t)
  timers.clear()
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
