<script setup lang="ts">
import type { AoeIndicator } from '@/core/range'
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { pieceStandingCellCenter } from '@/core/range'
import { primaryTag as pickPrimaryTag, readTagInstances, resolveTags } from '@/core/tag'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{ aoe: AoeIndicator }>()

const pieces = usePiecesStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const lib = useTagLibraryStore()

const centerPiece = computed(() =>
  pieces.list.find(p => p.characterId === props.aoe.characterId) ?? null,
)

// 半径语义与 RangeCircle 一致:Nm = N 格,圆心锚站立格中心 → 两者同心叠加。
const radiusPx = computed(() => props.aoe.radiusM * settings.grid.cellSizePx)
const diameterPx = computed(() => radiusPx.value * 2)

// svg 局部坐标:r = 像素半径;复刻 range.jsx 的 RangeExpressive。
const r = computed(() => radiusPx.value)
const ticks = computed(() => {
  const rr = r.value
  return Array.from({ length: 12 }).map((_, i) => {
    const a = (i / 12) * Math.PI * 2
    return {
      x1: rr + Math.cos(a) * (rr - 3),
      y1: rr + Math.sin(a) * (rr - 3),
      x2: rr + Math.cos(a) * (rr - 9),
      y2: rr + Math.sin(a) * (rr - 9),
    }
  })
})

const wrapStyle = computed(() => {
  const p = centerPiece.value
  if (!p)
    return { display: 'none' as const }
  const center = pieceStandingCellCenter(p, settings.grid)
  return {
    left: `${center.x - radiusPx.value}px`,
    top: `${center.y - radiusPx.value}px`,
    width: `${diameterPx.value}px`,
    height: `${diameterPx.value}px`,
  }
})

const char = computed(() => chars.byId(props.aoe.characterId))
// 阵营主 tag:盟友(蓝 #3498db) / 敌人(红 #e74c3c) / 其它,带 icon+label+color。
const tag = computed(() =>
  char.value ? pickPrimaryTag(resolveTags(readTagInstances(char.value), lib.byId)) : null,
)
const factionColor = computed(() => tag.value?.color ?? '#95a5a6')

const distanceLabel = computed(() => {
  const t = props.aoe.turnsRemaining
  return t != null ? `${props.aoe.radiusM}m · ${t}T` : `${props.aoe.radiusM}m`
})
</script>

<template>
  <div class="pointer-events-none absolute" :style="wrapStyle">
    <!-- 旋转符文环:整组 svg 转(慢速),标签另置不随转 -->
    <svg
      class="absolute inset-0"
      style="animation: auraSpin 90s linear infinite"
      :width="diameterPx" :height="diameterPx"
      :viewBox="`0 0 ${diameterPx} ${diameterPx}`"
    >
      <defs>
        <radialGradient :id="`aoe-fill-${aoe.id}`">
          <stop offset="0" :stop-color="aoe.color" stop-opacity="0" />
          <stop offset=".75" :stop-color="aoe.color" stop-opacity="0" />
          <stop offset="1" :stop-color="aoe.color" stop-opacity=".25" />
        </radialGradient>
      </defs>
      <circle :cx="r" :cy="r" :r="r - 3" :fill="`url(#aoe-fill-${aoe.id})`" />
      <circle :cx="r" :cy="r" :r="r - 3" fill="none" :stroke="aoe.color" stroke-width="1.4" stroke-dasharray="6 4" opacity=".9" />
      <circle :cx="r" :cy="r" :r="r - 9" fill="none" :stroke="aoe.color" stroke-width=".7" opacity=".4" stroke-dasharray="2 6" />
      <line
        v-for="(t, i) in ticks" :key="i"
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
        :stroke="aoe.color" stroke-width="1.2"
      />
    </svg>

    <!-- 阵营内发光(C):很淡的一层,不随转 -->
    <div
      class="absolute inset-0 rounded-full"
      :style="{ boxShadow: `inset 0 0 24px ${factionColor}33` }"
    />

    <!-- 顶部:tag 图标 + label 徽章,半径/回合徽章紧挨其右;字号参照 scene HP/MP 指示器(更小) -->
    <div class="absolute left-1/2 top-0 flex items-center gap-1 whitespace-nowrap -translate-x-1/2 -translate-y-1/2">
      <span
        class="inline-flex items-center gap-0.5 rounded px-1 py-px text-[6px] font-bold tracking-wide"
        :style="{ color: aoe.color, background: 'rgba(11,18,36,.98)', border: `1px solid ${aoe.color}`, textShadow: `0 0 4px ${aoe.color}` }"
      >
        <span
          v-if="tag?.icon"
          class="h-2 w-2 inline-flex items-center justify-center rounded-full"
          :style="{ background: factionColor }"
        >
          <span :class="tag.icon" class="text-[5px] text-white" />
        </span>
        {{ aoe.label }}
      </span>
      <span
        class="rounded px-1 py-px text-[6px]"
        :style="{ color: aoe.color, background: 'rgba(11,18,36,.98)', border: `1px solid ${aoe.color}` }"
      >
        {{ distanceLabel }}
      </span>
    </div>
  </div>
</template>
