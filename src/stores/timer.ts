// 会话计时器:GM 设总时长 → 开始/暂停/重置/微调,跨同一 GM 的多个浏览器 tab 同步(GM_setValue)。
// 玩家端不可见 —— 跟 TurnIndicator / encounter.shared 同语义。
//
// 状态模型 ——"wall-clock 锚点 + 暂停账面值":
//   running:  remaining = remainingSec - (now - startedAt) / 1000
//   paused:   remaining = remainingSec
// 这样跨 tab 同步只在 start/pause/adjust 时推一次,UI 自己 RAF tick 重算实时剩余,无漂移。

import type { TimerState } from '@/core/timer/compute-remaining'
import { defineStore } from 'pinia'
import { computeRemaining } from '@/core/timer/compute-remaining'
import { readSharedValue, writeSharedValue } from '@/infra/gm-values'

const SHARED_KEY = 'ccs:timer:shared'

// hidden 是"临时隐藏 chip"的旗标,跨 tab 同步,但保留 totalSec/remainingSec 不变。
// 跟 clear() 区别:clear 会把 totalSec 置 0 等于"取消",hidden 只让 chip 不显示但计时继续。
interface TimerStoreState extends TimerState {
  hidden: boolean
}

function defaultState(): TimerStoreState {
  return { totalSec: 0, remainingSec: 0, startedAt: null, hidden: false }
}

function loadShared(): TimerStoreState {
  const raw = readSharedValue<TimerStoreState>(SHARED_KEY, defaultState())
  return { ...defaultState(), ...raw }
}

export function persistTimer(state: TimerStoreState): void {
  writeSharedValue(SHARED_KEY, state)
}

declare function GM_addValueChangeListener(
  key: string,
  listener: (k: string, oldValue: unknown, newValue: unknown, remote: boolean) => void,
): number

// 跨 tab 同步:另一 tab 改 timer 时,本 tab 立即替换 state。remote=false 是自己写的,跳过避免回环。
export function bindTimerCrossTabSync(store: ReturnType<typeof useTimerStore>): void {
  if (typeof GM_addValueChangeListener !== 'function') {
    console.warn('[ccs] timer: GM_addValueChangeListener 不可用,跨 tab 同步关闭')
    return
  }
  GM_addValueChangeListener(SHARED_KEY, (_k, _old, newValue, remote) => {
    if (!remote)
      return
    try {
      const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
      if (!parsed || typeof parsed !== 'object')
        return
      store.$patch((state) => {
        Object.assign(state, defaultState(), parsed as Partial<TimerStoreState>)
      })
    }
    catch (e) {
      console.warn('[ccs] timer: apply remote change failed', e)
    }
  })
}

// 微调上限:允许越过 totalSec(GM 临时加时间),但不超过总时长 2 倍 —— 跟 HP 项目惯例一致(允许过量)。
function clampAdjust(value: number, totalSec: number): number {
  const upper = Math.max(totalSec * 2, 60)
  return Math.max(0, Math.min(upper, value))
}

export const useTimerStore = defineStore('timer', {
  state: (): TimerStoreState => loadShared(),
  getters: {
    // running 中要给"应用新总时长"判断用,组件层一般用 computeRemaining(state, Date.now()) 实时算。
    isRunning: state => state.startedAt != null,
  },
  actions: {
    setTotal(totalSec: number) {
      const safe = Math.max(0, Math.floor(totalSec))
      this.totalSec = safe
      this.remainingSec = safe
      this.startedAt = null
    },
    start() {
      if (this.totalSec <= 0)
        return
      // 已经过期就重置回 totalSec 再开;否则保留当前 remainingSec(便于"暂停后继续")。
      if (this.remainingSec <= 0)
        this.remainingSec = this.totalSec
      this.startedAt = Date.now()
    },
    pause() {
      if (this.startedAt == null)
        return
      this.remainingSec = computeRemaining(this.$state, Date.now())
      this.startedAt = null
    },
    reset() {
      this.remainingSec = this.totalSec
      this.startedAt = null
    },
    // 完全清空:totalSec=0 让 chip 的 v-if 失效从画面消失。GM 不需要计时时按这个。
    clear() {
      this.totalSec = 0
      this.remainingSec = 0
      this.startedAt = null
      this.hidden = false
    },
    // 临时把 chip 从画面藏起来,不影响计时本身。再点一次显示。
    toggleHidden() {
      this.hidden = !this.hidden
    },
    // running 时,把已 elapsed 的部分先折算回 remainingSec,加减 delta 后重置 startedAt,
    // 这样视觉上像"瞬间多/少了 N 秒",不丢正在走的那段。
    adjust(deltaSec: number) {
      if (this.startedAt != null) {
        const live = computeRemaining(this.$state, Date.now())
        this.remainingSec = clampAdjust(live + deltaSec, this.totalSec)
        this.startedAt = Date.now()
      }
      else {
        this.remainingSec = clampAdjust(this.remainingSec + deltaSec, this.totalSec)
      }
    },
  },
})
