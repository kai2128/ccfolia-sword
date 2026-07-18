<script setup lang="ts">
import { computed } from 'vue'

// 银边胶囊 HP/MP 指示器 — 设计稿见 docs/superpowers/plans/hpbar-enhance/...design_handoff_hp_mp/CapsuleBar.jsx。
// 几何全部按 height 推导,渐变停止色走 --cap-* token,字体走 UnoCSS web-fonts (font-serif / font-mono)。

type Kind = 'hp' | 'mp' | 'sp' | 'shield' | 'danger'

const props = withDefaults(defineProps<{
  kind?: Kind
  cur: number
  max: number
  width?: number
  height?: number
  hit?: boolean
  showValue?: boolean
  // 传 '' 隐藏 diamond 字母(多部位时由父级 part label 替代)
  label?: string
  // 数值垂直锚点:
  //   center 默认贴 bar 中线;top 让数值上挑出 bar 顶,bottom 让数值下沉到 bar 底。
  //   配对成 HP=top + MP=bottom 时,两个数值垂直错开,各自可以更大且不重叠。
  valueAnchor?: 'center' | 'top' | 'bottom'
  // 显式指定数值字号,默认按 height 推。配对里大数字时用得上。
  valueFontPx?: number
}>(), {
  kind: 'hp',
  width: 200,
  height: 22,
  hit: false,
  showValue: true,
  valueAnchor: 'center',
})

const palette: Record<Kind, { glyph: string }> = {
  hp: { glyph: 'HP' },
  mp: { glyph: 'MP' },
  sp: { glyph: 'SP' },
  shield: { glyph: '盾' },
  danger: { glyph: 'HP' },
}

const w = computed(() => props.width)
const h = computed(() => props.height)
const dia = computed(() => h.value * 0.9)
const innerLeft = computed(() => dia.value * 0.5)
const innerW = computed(() => w.value - 2 - innerLeft.value)
const ratio = computed(() => {
  if (props.max <= 0)
    return 0
  return Math.max(0, Math.min(1, props.cur / props.max))
})
const fillW = computed(() => innerW.value * ratio.value)

// HP 走血量分档:>50% hp / ≤50% warn / ≤25% danger。其它 kind(mp/sp/shield/显式 danger)原样。
const fillKind = computed(() => {
  if (props.kind !== 'hp')
    return props.kind
  if (ratio.value <= 0.25)
    return 'danger'
  if (ratio.value <= 0.5)
    return 'warn'
  return 'hp'
})

const id = computed(() => `cb-${fillKind.value}-${w.value}-${h.value}`)

// SVG path 字符串 — 三段共用,提一处。
const barPath = computed(() => {
  const W = w.value
  const H = h.value
  const L = innerLeft.value
  return `M ${L} 1 L ${W - H * 0.5} 1 Q ${W - 1} 1 ${W - 1} ${H / 2} Q ${W - 1} ${H - 1} ${W - H * 0.5} ${H - 1} L ${L} ${H - 1} Z`
})
const barOutlinePath = computed(() => {
  const W = w.value
  const H = h.value
  const L = innerLeft.value
  return `M ${L} 1 L ${W - H * 0.5} 1 Q ${W - 1} 1 ${W - 1} ${H / 2} Q ${W - 1} ${H - 1} ${W - H * 0.5} ${H - 1} L ${L} ${H - 1}`
})
const diamondPath = computed(() => {
  const D = dia.value
  const H = h.value
  return `M 0 ${H / 2} L ${D / 2} ${-D * 0.05} L ${D} ${H / 2} L ${D / 2} ${H + D * 0.05} Z`
})
const sparklePath = computed(() => {
  const D = dia.value
  const H = h.value
  return `M ${D / 2} ${H * 0.25} L ${D * 0.62} ${H / 2} L ${D / 2} ${H * 0.75} L ${D * 0.38} ${H / 2} Z`
})
const dotR = computed(() => Math.max(0.8, h.value * 0.06))

const viewBox = computed(() => `${-dia.value * 0.15} ${-h.value * 0.1} ${w.value + dia.value * 0.15} ${h.value * 1.15}`)
const svgHeight = computed(() => h.value * 1.15)

const labelText = computed(() => props.label ?? palette[props.kind].glyph)
// label (diamond 旁的 HP/MP 字) — 回到第一版的轻量风格,跟随 bar 高度比例。
const labelFontSize = computed(() => Math.round(h.value * 0.5))
// value 默认按 height 推,父级用 valueFontPx 显式覆盖时优先。
const valueFontSize = computed(() => props.valueFontPx ?? Math.max(9, Math.round(h.value * 0.6)))

// 数值容器的垂直定位 — top/bottom 锚点时贴 bar 顶/底,允许文字上下溢出 bar 区。
const valueTop = computed(() => {
  const fs = valueFontSize.value
  if (props.valueAnchor === 'top')
    return `${-fs / 2}px`
  if (props.valueAnchor === 'bottom')
    return `${h.value - fs / 2}px`
  return '0'
})
const valueContainerHeight = computed(() => {
  if (props.valueAnchor === 'center')
    return `${h.value}px`
  return `${valueFontSize.value}px`
})

// 0 血时整体灰度 + 半透明,作为 "downed" 视觉
const downed = computed(() => props.cur <= 0)
</script>

<template>
  <div
    class="relative inline-flex items-center"
    :class="[
      hit && 'fx-shake',
      downed && 'opacity-40 [filter:grayscale(0.7)]',
    ]"
    :style="{ width: `${w}px`, height: `${h}px` }"
  >
    <svg
      :width="w"
      :height="svgHeight"
      :viewBox="viewBox"
      style="overflow: visible; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.45));"
    >
      <defs>
        <linearGradient :id="`${id}-fill`" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" :stop-color="`var(--cap-${fillKind}-1)`" />
          <stop offset=".5" :stop-color="`var(--cap-${fillKind}-2)`" />
          <stop offset="1" :stop-color="`var(--cap-${fillKind}-2)`" stop-opacity=".75" />
        </linearGradient>
        <linearGradient :id="`${id}-rim`" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--cap-rim-top)" />
          <stop offset=".5" stop-color="var(--cap-rim-mid)" />
          <stop offset="1" stop-color="var(--cap-rim-bot)" />
        </linearGradient>
        <linearGradient :id="`${id}-bg`" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--cap-bg-top)" />
          <stop offset="1" stop-color="var(--cap-bg-bot)" />
        </linearGradient>
        <clipPath :id="`${id}-clip`">
          <path :d="barPath" />
        </clipPath>
      </defs>

      <!-- bar 背景 -->
      <path :d="barPath" :fill="`url(#${id}-bg)`" />

      <!-- fill,夹在 clipPath 里防溢出 -->
      <g :clip-path="`url(#${id}-clip)`">
        <rect
          :x="innerLeft"
          y="1"
          :width="fillW"
          :height="h - 2"
          :fill="`url(#${id}-fill)`"
          style="transition: width var(--t-base) var(--ease-out);"
        />
      </g>

      <!-- 银边 -->
      <path
        :d="barOutlinePath"
        fill="none"
        :stroke="`url(#${id}-rim)`"
        stroke-width="1.1"
        stroke-linejoin="round"
      />

      <!-- diamond 头 -->
      <g>
        <path
          :d="diamondPath"
          :fill="`url(#${id}-bg)`"
          :stroke="`url(#${id}-rim)`"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <path :d="sparklePath" :fill="`var(--cap-${fillKind}-1)`" opacity=".95" />
        <circle :cx="dia / 2" :cy="h / 2" :r="dotR" fill="#fff" />
      </g>
    </svg>

    <!-- diamond 旁边的 label 字 (HP/MP/...) — 第一版轻量风格 -->
    <div
      v-if="labelText"
      class="pointer-events-none absolute top-0 flex items-center text-white font-serif"
      :style="{
        left: `${dia + 4}px`,
        height: `${h}px`,
        fontSize: `${labelFontSize}px`,
        fontWeight: 700,
        letterSpacing: '.04em',
        textShadow: '0 1px 2px rgba(0,0,0,.7)',
      }"
    >
      {{ labelText }}
    </div>

    <!-- 数值 cur/max,文字外置在 bar 右边外侧;锚点决定垂直对齐(center/top/bottom) -->
    <div
      v-if="showValue"
      class="pointer-events-none absolute flex items-center text-white font-mono"
      :style="{
        right: '5px',
        top: valueTop,
        height: valueContainerHeight,
        fontSize: `${valueFontSize}px`,
        fontWeight: 800,
        letterSpacing: '.02em',
        lineHeight: 1,
        textShadow: '0 0 3px #000, 0 1px 2px rgba(0,0,0,.95)',
      }"
    >
      {{ cur }}<span style="opacity: .7;">/{{ max }}</span>
    </div>
  </div>
</template>
