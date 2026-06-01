<script setup lang="ts">
// 上方中央浮动倒计时 chip。视觉规范见 docs/superpowers/plans/timer/handoff/SessionTimer.tsx。
// 状态阶梯:normal > 20m → warning ≤ 20m → critical ≤ 5m → expired = 0。
// 必须挂在主 app 根(App.vue),不能挂 SceneOverlayRoot —— canvas 上的 transform: scale 会
// 把 fixed-position 的 containing-block 劫持掉,效果失效。同 TurnIndicator。

import type { SessionState, TimerState } from '@/core/timer/compute-remaining'
import { computed, onBeforeUnmount, ref } from 'vue'
import { computeRemaining, fmtHMS, getSessionState } from '@/core/timer/compute-remaining'
import { useTimerStore } from '@/stores/timer'

const timer = useTimerStore()

// totalSec=0 = 还没设过;hidden = GM 临时藏了。两种情况都不显示。
const visible = computed(() => timer.totalSec > 0 && !timer.hidden)

// RAF tick 自驱:running 时每帧更新 nowMs;暂停时 watch store 改动也会触发 reactive 重算。
const nowMs = ref(Date.now())
let raf = 0
function loop() {
  nowMs.value = Date.now()
  raf = requestAnimationFrame(loop)
}
raf = requestAnimationFrame(loop)
onBeforeUnmount(() => cancelAnimationFrame(raf))

const remaining = computed(() => computeRemaining(timer.$state as TimerState, nowMs.value))
const state = computed<SessionState>(() => getSessionState(remaining.value, timer.totalSec))
const display = computed(() => fmtHMS(remaining.value))
const pct = computed(() => {
  if (timer.totalSec <= 0)
    return 0
  return Math.max(0, Math.min(1, remaining.value / timer.totalSec))
})

interface Palette {
  ink: string
  rim: string
  glow: string
}

const PALETTE: Record<SessionState, Palette> = {
  normal: { ink: '#f4ecd5', rim: '#e7c66a', glow: 'rgba(231,198,106,.35)' },
  warning: { ink: '#f7e7a8', rim: '#f7c544', glow: 'rgba(247,197,68,.5)' },
  critical: { ink: '#ffb3a8', rim: '#ff6a55', glow: 'rgba(255,106,85,.65)' },
  expired: { ink: '#7a6a5a', rim: '#6b5a3a', glow: 'rgba(0,0,0,.4)' },
}

// 暂停态:统一切到冷色(slate-blue)"冻结"色,跟走行中的暖色 palette 一眼区分。
const PAUSED_PALETTE: Palette = { ink: '#a9bdd9', rim: '#6f86b0', glow: 'rgba(111,134,176,.4)' }

const palette = computed(() => timer.isRunning ? PALETTE[state.value] : PAUSED_PALETTE)
</script>

<template>
  <div
    v-if="visible"
    class="pointer-events-none fixed flex select-none items-center gap-2.5 rounded px-3.5 py-1.5"
    style="
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: rgba(11, 18, 36, 0.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    "
    :style="{
      border: `1px solid ${!timer.isRunning ? palette.rim : (state === 'critical' ? palette.rim : 'rgba(231,198,106,.5)')}`,
      boxShadow: `0 4px 14px rgba(0,0,0,.5), 0 0 14px ${palette.glow}`,
    }"
  >
    <!-- 状态点 -->
    <span
      class="inline-block h-1.5 w-1.5 rounded-full"
      :style="{
        background: palette.rim,
        boxShadow: `0 0 6px ${palette.rim}`,
        animation: !timer.isRunning
          ? 'none'
          : state === 'critical'
            ? 'session-timer-pulse 1s infinite'
            : 'session-timer-breathe 2s ease-in-out infinite',
      }"
    />
    <!-- 时间数字 -->
    <span
      class="text-[15px] font-semibold font-mono tabular-nums"
      :style="{
        color: palette.ink,
        letterSpacing: '.06em',
        textShadow: state !== 'normal' ? `0 0 6px ${palette.glow}` : 'none',
      }"
    >
      {{ display }}
    </span>
    <!-- 底部进度细线轨道 + 实进度 -->
    <span
      class="absolute"
      style="left: 14px; right: 14px; bottom: 1px; height: 1.5px; background: rgba(231, 198, 106, 0.12);"
    />
    <span
      class="absolute"
      style="left: 14px; bottom: 1px; height: 1.5px; transition: width 100ms linear;"
      :style="{
        width: `calc((100% - 28px) * ${pct})`,
        background: palette.rim,
        boxShadow: `0 0 6px ${palette.glow}`,
      }"
    />
  </div>
</template>
