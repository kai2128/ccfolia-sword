<script setup lang="ts">
// C 变体 — 菱形帽 + 融合 HP(上半)/MP(下半)条 + 右侧堆叠数值列。
// 设计稿原版只为单角色单 HP 设计;为支持多部位 C 堆叠,新增可选 label 前缀
// (Noto Serif SC,与 PartInlinePill 的 part label 视觉同源)。
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  hp: { cur: number, max: number }
  mp?: { cur: number, max: number } | null
  width?: number
  showValue?: boolean
  label?: string
  broken?: boolean
}>(), {
  width: 60,
  showValue: true,
  broken: false,
})

const hr = computed(() => props.hp.max > 0 ? Math.max(0, Math.min(1, props.hp.cur / props.hp.max)) : 0)
const mr = computed(() => (props.mp && props.mp.max > 0) ? Math.max(0, Math.min(1, props.mp.cur / props.mp.max)) : 0)
const lowHp = computed(() => !props.broken && hr.value <= 0.25)
const hasMp = computed(() => !!(props.mp && props.mp.max > 0))

const dia = 8
const barH = 7
const barW = computed(() => props.width - dia + 1)
const transition = 'width var(--t-base, 240ms) var(--ease-out, cubic-bezier(.2,.7,.2,1))'

// 唯一 ID,避免同页多个 C 实例的 SVG defs 冲突
const uid = computed(() => `md-rim-${Math.random().toString(36).slice(2, 9)}`)
</script>

<template>
  <div
    class="inline-flex items-center"
    :style="{ gap: '3px', opacity: broken ? .55 : 1 }"
  >
    <span
      v-if="label"
      class="font-serif"
      :style="{
        fontSize: '9px',
        color: broken ? '#8c5e5e' : '#c9bf9b',
        textDecoration: broken ? 'line-through' : 'none',
        letterSpacing: '.05em',
        textShadow: '0 1px 1px #000',
        whiteSpace: 'nowrap',
      }"
    >{{ label }}</span>
    <div
      :style="{
        width: `${width}px`,
        height: `${barH}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }"
    >
      <svg
        :width="width"
        :height="barH + 2"
        :viewBox="`0 -1 ${width} ${barH + 2}`"
        style="overflow: visible"
      >
        <defs>
          <linearGradient :id="uid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#f4f6fa" />
            <stop offset="1" stop-color="#4a505a" />
          </linearGradient>
        </defs>
        <!-- bar 槽底 -->
        <rect
          :x="dia / 2" y="0"
          :width="barW" :height="barH"
          fill="#06091a"
          :stroke="`url(#${uid})`"
          stroke-width=".7"
        />
        <!-- HP fill(上半) -->
        <rect
          :x="dia / 2 + .5" y=".5"
          :width="(barW - 1) * hr"
          :height="(barH - 1) / 2"
          :fill="lowHp ? '#d04a4a' : '#3aa86a'"
          :style="{ transition }"
        />
        <rect
          :x="dia / 2 + .5" y=".5"
          :width="(barW - 1) * hr"
          :height="(barH - 1) / 4"
          :fill="lowHp ? '#ffb3b3' : '#b8f5c8'"
          opacity=".7"
          :style="{ transition }"
        />
        <!-- MP fill(下半),仅有 MP 时 -->
        <template v-if="hasMp">
          <rect
            :x="dia / 2 + .5" :y=".5 + (barH - 1) / 2"
            :width="(barW - 1) * mr"
            :height="(barH - 1) / 2"
            fill="#3a72c8"
            :style="{ transition }"
          />
          <rect
            :x="dia / 2 + .5" :y=".5 + (barH - 1) / 2"
            :width="(barW - 1) * mr"
            :height="(barH - 1) / 4"
            fill="#b8d8ff"
            opacity=".55"
            :style="{ transition }"
          />
        </template>
        <!-- 菱形帽 -->
        <path
          :d="`M 0 ${barH / 2} L ${dia / 2} -.5 L ${dia} ${barH / 2} L ${dia / 2} ${barH + .5} Z`"
          fill="#06091a"
          :stroke="`url(#${uid})`"
          stroke-width=".8"
        />
        <path
          :d="`M ${dia / 2} ${barH * 0.2} L ${dia * 0.62} ${barH / 2} L ${dia / 2} ${barH * 0.8} L ${dia * 0.38} ${barH / 2} Z`"
          fill="#b8f5c8"
          opacity=".95"
        />
      </svg>
    </div>
    <div
      v-if="showValue"
      class="flex flex-col items-start font-mono"
      :style="{
        fontSize: '8px',
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: '-.03em',
        textShadow: '0 1px 1px #000',
      }"
    >
      <span :style="{ color: lowHp ? '#ffb3b3' : '#b8f5c8' }">
        {{ hp.cur }}<span style="opacity: .5">/{{ hp.max }}</span>
      </span>
      <span v-if="hasMp" style="color: #b8d8ff">
        {{ mp!.cur }}<span style="opacity: .5">/{{ mp!.max }}</span>
      </span>
    </div>
  </div>
</template>
