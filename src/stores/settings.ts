// 用户偏好 store。持久化的 UI 状态也塞这里 —— 面板位置 / 是否折叠。
import { defineStore } from 'pinia'
import { setRingSize } from '@/infra/log'
import { gmStorage } from '@/infra/pinia-persist-adapter'

export interface PanelPos {
  x: number
  y: number
}

interface SettingsState {
  defaultPowerTableId: string | null
  logMaxLines: number
  theme: 'light' | 'dark' | 'auto'
  panelPos: PanelPos
  panelCollapsed: boolean
}

// 默认右下角偏移,和 Phase 1~3 位置视觉一致
const DEFAULT_POS: PanelPos = { x: window.innerWidth - 320, y: window.innerHeight - 360 }

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    defaultPowerTableId: null,
    logMaxLines: 500,
    theme: 'auto',
    panelPos: { ...DEFAULT_POS },
    panelCollapsed: false,
  }),
  actions: {
    setDefaultPowerTable(id: string | null) {
      this.defaultPowerTableId = id
    },
    setTheme(theme: SettingsState['theme']) {
      this.theme = theme
    },
    setLogMaxLines(n: number) {
      this.logMaxLines = n
      setRingSize(n)
    },
    applyLogMaxLines() {
      setRingSize(this.logMaxLines)
    },
    setPanelPos(pos: PanelPos) {
      this.panelPos = pos
    },
    togglePanelCollapsed() {
      this.panelCollapsed = !this.panelCollapsed
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:settings',
  },
})
