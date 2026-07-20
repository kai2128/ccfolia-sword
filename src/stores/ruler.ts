// 测距工具状态。即时工具:不落 Firestore、不同步给房间参与者;但跨同一浏览器多 tab 同步(GM_setValue)。
// 抄 timer store 的范式。hover 预览段不在这里 —— 留 RulerLayer.vue 本地 ref,避免 mousemove 高频写 GM。
import type { CellRef } from '@/core/range'
import { defineStore } from 'pinia'
import { bindGmCrossTabSync } from '@/infra/gm-cross-tab'
import { readSharedValue, writeSharedValue } from '@/infra/gm-values'

const SHARED_KEY = 'ccs:ruler:shared'

export interface RulerSharedState {
  active: boolean
  finished: CellRef[][] // 已结束、留屏的测量
  current: CellRef[] // 正在画的一条
}

function defaultState(): RulerSharedState {
  return { active: false, finished: [], current: [] }
}

function loadShared(): RulerSharedState {
  return { ...defaultState(), ...readSharedValue<RulerSharedState>(SHARED_KEY, defaultState()) }
}

export function persistRuler(state: RulerSharedState): void {
  writeSharedValue(SHARED_KEY, state)
}

// 另一 tab 改测距时,本 tab 立即替换 state。
export function bindRulerCrossTabSync(store: ReturnType<typeof useRulerStore>): void {
  bindGmCrossTabSync<Partial<RulerSharedState>>(SHARED_KEY, (parsed) => {
    store.$patch((state) => {
      Object.assign(state, defaultState(), parsed)
    })
  }, 'ruler')
}

const sameCell = (a: CellRef, b: CellRef): boolean => a.col === b.col && a.row === b.row

export const useRulerStore = defineStore('ruler', {
  state: (): RulerSharedState => loadShared(),
  actions: {
    setActive(v: boolean) {
      this.active = v
      if (!v) {
        // 退出即清空
        this.finished = []
        this.current = []
      }
    },
    toggle() {
      this.setActive(!this.active)
    },
    addPoint(cell: CellRef) {
      const last = this.current[this.current.length - 1]
      if (last && sameCell(last, cell))
        return // 同格连点忽略
      this.current = [...this.current, cell]
    },
    // 结束当前这条,留屏;下次落点开新的一条。不足两点则丢弃。
    finishCurrent() {
      if (this.current.length >= 2)
        this.finished = [...this.finished, this.current]
      this.current = []
    },
    // Esc:清空全部测量,保持 active。
    clearAll() {
      this.finished = []
      this.current = []
    },
  },
})
