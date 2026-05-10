<script setup lang="ts">
// GM 计时器控制面板。设总时长 → 开始/暂停/重置 → 微调 ±10s/±1m。
// 顶部大字号 HH:MM:SS 用同款 palette 实时反映 chip 状态。
//
// 数据流走 timer store(GM_setValue 跨 tab 同步,玩家不可见)。组件本身无业务状态,
// 只有"设置总时长"的两个输入框是 draft form,提交时调 setTotal。

import type { SessionState, TimerState } from '@/core/timer/compute-remaining'
import { computed, onBeforeUnmount, ref } from 'vue'
import { Button, Input, PopConfirm } from '@/components/ui'
import { computeRemaining, fmtHMS, getSessionState } from '@/core/timer/compute-remaining'
import { useTimerStore } from '@/stores/timer'

const timer = useTimerStore()

// 设总时长 draft —— 时:分:秒三个数字输入,提交时合并写入。
const draftHour = ref(timer.totalSec > 0 ? Math.floor(timer.totalSec / 3600) : 0)
const draftMin = ref(timer.totalSec > 0 ? Math.floor((timer.totalSec % 3600) / 60) : 3)
const draftSec = ref(timer.totalSec > 0 ? timer.totalSec % 60 : 0)

function applyTotal() {
  const total = readDraft(draftHour.value, draftMin.value, draftSec.value)
  if (total > 0)
    timer.setTotal(total)
}

// 直接设当前剩余 draft —— 同样三个 input,提交后立即覆盖 remainingSec(running 也支持)。
const setHour = ref(0)
const setMin = ref(0)
const setSec = ref(0)

function applySetCurrent() {
  const sec = readDraft(setHour.value, setMin.value, setSec.value)
  timer.setRemaining(sec)
}

function readDraft(h: unknown, m: unknown, s: unknown): number {
  const hh = Math.max(0, Math.floor(Number(h) || 0))
  const mm = Math.max(0, Math.floor(Number(m) || 0))
  const ss = Math.max(0, Math.floor(Number(s) || 0))
  return hh * 3600 + mm * 60 + ss
}

// RAF tick 自驱:跟 chip 同样套路,显示实时剩余。
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

const PALETTE_INK: Record<SessionState, string> = {
  normal: '#f4ecd5',
  warning: '#f7e7a8',
  critical: '#ffb3a8',
  expired: '#7a6a5a',
}

const inkColor = computed(() => PALETTE_INK[state.value])
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 实时剩余大字号显示 -->
    <div class="flex flex-col items-center gap-1 border border-white/10 rounded bg-black/30 py-3">
      <span class="text-xs text-white/50 tracking-wider">剩余</span>
      <span
        class="text-3xl font-semibold font-mono tabular-nums"
        :style="{ color: inkColor, letterSpacing: '.08em' }"
      >
        {{ display }}
      </span>
      <span class="text-xs text-white/40">
        总 {{ fmtHMS(timer.totalSec) }}
        <template v-if="timer.isRunning">
          · 运行中
        </template>
        <template v-else-if="timer.totalSec > 0">
          · 已暂停
        </template>
      </span>
    </div>

    <!-- 控制按钮 -->
    <div class="flex items-center justify-between gap-2">
      <!-- 左:运行控制 + 显隐 -->
      <div class="flex gap-2">
        <Button
          v-if="!timer.isRunning"
          size="sm"
          :disabled="timer.totalSec <= 0"
          @click="timer.start()"
        >
          <span class="i-lucide-play h-3 w-3" />
          开始
        </Button>
        <Button
          v-else
          size="sm"
          variant="ghost"
          @click="timer.pause()"
        >
          <span class="i-lucide-pause h-3 w-3" />
          暂停
        </Button>
        <Button
          size="sm"
          variant="ghost"
          :disabled="timer.totalSec <= 0"
          :title="timer.hidden ? '在画面上显示 chip' : '从画面临时隐藏 chip(计时继续)'"
          @click="timer.toggleHidden()"
        >
          <span :class="timer.hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="h-3 w-3" />
          {{ timer.hidden ? '显示' : '隐藏' }}
        </Button>
      </div>

      <!-- 右:重置 + 删除 -->
      <div class="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          :disabled="timer.totalSec <= 0"
          @click="timer.reset()"
        >
          <span class="i-lucide-rotate-ccw h-3 w-3" />
          重置
        </Button>
        <PopConfirm
          message="确认清空计时器?"
          confirm-text="清空"
          @confirm="timer.clear()"
        >
          <Button
            size="sm"
            variant="danger"
            :disabled="timer.totalSec <= 0"
          >
            <span class="i-lucide-trash-2 h-3 w-3" />
            删除
          </Button>
        </PopConfirm>
      </div>
    </div>

    <!-- 设置总时长 -->
    <div class="flex flex-col gap-2">
      <span class="text-xs text-white/50">设置总时长</span>
      <div class="flex flex-wrap items-center gap-2">
        <div class="w-14">
          <Input v-model="draftHour" type="number" min="0" />
        </div>
        <span class="text-xs text-white/60">时</span>
        <div class="w-14">
          <Input v-model="draftMin" type="number" min="0" max="59" />
        </div>
        <span class="text-xs text-white/60">分</span>
        <div class="w-14">
          <Input v-model="draftSec" type="number" min="0" max="59" />
        </div>
        <span class="text-xs text-white/60">秒</span>
        <Button size="sm" @click="applyTotal">
          应用
        </Button>
      </div>
    </div>

    <!-- 直接设当前剩余 -->
    <div class="flex flex-col gap-2">
      <span class="text-xs text-white/50">设当前剩余</span>
      <div class="flex flex-wrap items-center gap-2">
        <div class="w-14">
          <Input v-model="setHour" type="number" min="0" />
        </div>
        <span class="text-xs text-white/60">时</span>
        <div class="w-14">
          <Input v-model="setMin" type="number" min="0" max="59" />
        </div>
        <span class="text-xs text-white/60">分</span>
        <div class="w-14">
          <Input v-model="setSec" type="number" min="0" max="59" />
        </div>
        <span class="text-xs text-white/60">秒</span>
        <Button size="sm" :disabled="timer.totalSec <= 0" @click="applySetCurrent">
          应用
        </Button>
      </div>
    </div>

    <!-- 微调 -->
    <div class="flex flex-col gap-2">
      <span class="text-xs text-white/50">微调</span>
      <div class="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" :disabled="timer.totalSec <= 0" @click="timer.adjust(-300)">
          -5m
        </Button>
        <Button size="sm" variant="ghost" :disabled="timer.totalSec <= 0" @click="timer.adjust(-60)">
          -1m
        </Button>
        <Button size="sm" variant="ghost" :disabled="timer.totalSec <= 0" @click="timer.adjust(-10)">
          -10s
        </Button>
        <Button size="sm" variant="ghost" :disabled="timer.totalSec <= 0" @click="timer.adjust(10)">
          +10s
        </Button>
        <Button size="sm" variant="ghost" :disabled="timer.totalSec <= 0" @click="timer.adjust(60)">
          +1m
        </Button>
        <Button size="sm" variant="ghost" :disabled="timer.totalSec <= 0" @click="timer.adjust(300)">
          +5m
        </Button>
      </div>
    </div>
  </div>
</template>
