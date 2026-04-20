// 用户偏好 store。持久化的 UI 状态也塞这里 —— 面板位置 / 是否折叠。
import { defineStore } from 'pinia'
import { setRingSize } from '@/infra/log'
import { gmStorage } from '@/infra/pinia-persist-adapter'

export interface PanelPos {
  x: number
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

interface SettingsState {
  defaultPowerTableId: string | null
  logMaxLines: number
  theme: 'light' | 'dark' | 'auto'
  panelPos: PanelPos
  panelCollapsed: boolean
}

const DEFAULT_PANEL_SIZE: PanelSize = { width: 320, height: 360 }

function normalizeLength(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeCoord(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeSize(size: Partial<PanelSize> | undefined, fallback: PanelSize): PanelSize {
  return {
    width: normalizeLength(size?.width ?? Number.NaN, fallback.width),
    height: normalizeLength(size?.height ?? Number.NaN, fallback.height),
  }
}

function getWindowViewport(): PanelSize {
  if (typeof window === 'undefined')
    return DEFAULT_PANEL_SIZE
  return { width: window.innerWidth, height: window.innerHeight }
}

function getViewportSize(viewport?: Partial<PanelSize>): PanelSize {
  return normalizeSize(viewport, getWindowViewport())
}

// 默认右下角偏移,和 Phase 1~3 位置视觉一致。
export function getDefaultPanelPos(
  viewport?: Partial<PanelSize>,
  panel?: Partial<PanelSize>,
): PanelPos {
  const nextViewport = getViewportSize(viewport)
  const nextPanel = normalizeSize(panel, DEFAULT_PANEL_SIZE)
  return {
    x: Math.max(0, nextViewport.width - nextPanel.width),
    y: Math.max(0, nextViewport.height - nextPanel.height),
  }
}

// 持久化恢复出来的数据可能来自旧版本、坏拖拽或不同分辨率窗口,这里统一净化。
export function clampPanelPos(
  pos: Partial<PanelPos> | null | undefined,
  opts: {
    viewport?: Partial<PanelSize>
    panel?: Partial<PanelSize>
  } = {},
): PanelPos {
  const viewport = getViewportSize(opts.viewport)
  const panel = normalizeSize(opts.panel, DEFAULT_PANEL_SIZE)
  const fallback = getDefaultPanelPos(viewport, panel)
  const maxX = Math.max(0, viewport.width - panel.width)
  const maxY = Math.max(0, viewport.height - panel.height)
  const x = normalizeCoord(pos?.x ?? undefined, fallback.x)
  const y = normalizeCoord(pos?.y ?? undefined, fallback.y)

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    defaultPowerTableId: null,
    logMaxLines: 500,
    theme: 'auto',
    panelPos: getDefaultPanelPos(),
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
      this.panelPos = clampPanelPos(pos)
    },
    ensurePanelVisible(panel?: Partial<PanelSize>) {
      this.panelPos = clampPanelPos(this.panelPos, { panel })
    },
    togglePanelCollapsed() {
      this.panelCollapsed = !this.panelCollapsed
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:settings',
    afterHydrate: ({ store }) => {
      ;(store as ReturnType<typeof useSettingsStore>).ensurePanelVisible()
    },
  },
})
