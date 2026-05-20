<script setup lang="ts">
import { computed } from 'vue'

// MP 增减·克制版内联演出(token 尺度,比 HP 小一号、蓝色)。
// 设计稿见 docs/superpowers/plans/design_handoff_mp_fx(FXMPDelta 那一档)。
// 数据驱动:gain=true 走 restore(青蓝、环扩张、光点外飘),false 走 drain(靛蓝、环收缩、光点向心)。

const props = defineProps<{
  // x/y 是相对于 offset parent 的画布像素(立绘中心)
  x: number
  y: number
  amount: number
  gain: boolean
}>()

const SIZE = 56

const MP_PALETTE = {
  drain: { accent: '#5a72c8', glow: '#a8b0e6' },
  restore: { accent: '#5dc8ff', glow: '#dff4ff' },
} as const

const pal = computed(() => (props.gain ? MP_PALETTE.restore : MP_PALETTE.drain))
const sign = computed(() => (props.gain ? '+' : '−'))

// 5 颗光点按 -π/2 起始、均分一圈摆位,半径 size*0.42。
const motes = computed(() => Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2 - Math.PI / 2
  const radius = SIZE * 0.42
  return {
    mx: `${Math.cos(a) * radius}px`,
    my: `${Math.sin(a) * radius}px`,
    // 逐颗错峰:680 + i*40ms 时长,i*55ms 延迟。
    animation: `${props.gain ? 'mpMoteOut' : 'mpMoteIn'} ${680 + i * 40}ms var(--ease-out) ${i * 55}ms forwards`,
  }
}))
</script>

<template>
  <div
    class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${SIZE}px`, height: `${SIZE}px` }"
  >
    <!-- 收缩/扩张的虚线符文环 -->
    <div
      class="absolute rounded-full"
      :style="{
        inset: 0,
        border: `1.4px dashed ${pal.accent}`,
        boxShadow: `0 0 8px ${pal.accent}66, inset 0 0 8px ${pal.accent}44`,
        transformOrigin: 'center',
        animation: `${gain ? 'mpRingExpand' : 'mpRingContract'} 720ms var(--ease-out) forwards`,
      }"
    />
    <!-- 5 颗光点 -->
    <div
      v-for="(m, i) in motes"
      :key="i"
      class="absolute rounded-full"
      :style="{
        'left': '50%',
        'top': '50%',
        'width': '3px',
        'height': '3px',
        'marginLeft': '-1.5px',
        'marginTop': '-1.5px',
        'background': pal.glow,
        'boxShadow': `0 0 4px ${pal.accent}, 0 0 8px ${pal.accent}`,
        '--mp-mx': m.mx,
        '--mp-my': m.my,
        'animation': m.animation,
      }"
    />
    <!-- 浮动 MP 数字(只显示带符号数值,不带 MP 前缀) -->
    <div
      class="absolute font-bold font-serif"
      :style="{
        left: '50%',
        top: '-2px',
        fontSize: '14px',
        color: pal.accent,
        whiteSpace: 'nowrap',
        textShadow: `0 1px 3px #000, 0 0 8px ${pal.accent}`,
        animation: 'mpFloatUp 1000ms var(--ease-out) forwards',
      }"
    >
      {{ sign }}{{ amount }}
    </div>
  </div>
</template>
