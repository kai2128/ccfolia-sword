// 用户偏好 store。持久化的 UI 状态也塞这里 —— 面板位置 / 是否折叠。
import type { GridConfig } from '@/core/range'
import type { StatusLabelMap } from '@/core/status-slot'
import { defineStore } from 'pinia'
import { DEFAULT_GRID_CONFIG } from '@/core/range'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'
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
  panelVisible: boolean
  grid: GridConfig
  gridOverlayVisible: boolean
  statusLabelMap: StatusLabelMap
  autoRotateAllyOnDown: boolean
  combatFxEnabled: boolean
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

function normalizeGridConfig(raw: unknown): GridConfig {
  const v = (raw && typeof raw === 'object') ? raw as Partial<GridConfig> : {}
  const origin = (v.originPx && typeof v.originPx === 'object')
    ? v.originPx as Partial<GridConfig['originPx']>
    : {}
  return {
    cols: normalizeLength(Number(v.cols ?? Number.NaN), DEFAULT_GRID_CONFIG.cols),
    rows: normalizeLength(Number(v.rows ?? Number.NaN), DEFAULT_GRID_CONFIG.rows),
    cellSizePx: normalizeLength(Number(v.cellSizePx ?? Number.NaN), DEFAULT_GRID_CONFIG.cellSizePx),
    originPx: {
      x: normalizeCoord(typeof origin.x === 'number' ? origin.x : undefined, DEFAULT_GRID_CONFIG.originPx.x),
      y: normalizeCoord(typeof origin.y === 'number' ? origin.y : undefined, DEFAULT_GRID_CONFIG.originPx.y),
    },
    pieceAnchor: v.pieceAnchor === 'top-left' ? 'top-left' : 'center',
  }
}

// readStatusSlot 按精确 label 匹配 ccfolia 的 status.label,任何前后空白或纯空白
// 都会让匹配稳定返回 null,所以在这里 trim 后再判空,脏值直接回落默认。
function normalizeStatusLabel(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string')
    return fallback
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function normalizeStatusLabelMap(raw: unknown): StatusLabelMap {
  const v = (raw && typeof raw === 'object') ? raw as Partial<StatusLabelMap> : {}
  return {
    hp: normalizeStatusLabel(v.hp, DEFAULT_STATUS_LABEL_MAP.hp),
    mp: normalizeStatusLabel(v.mp, DEFAULT_STATUS_LABEL_MAP.mp),
    defense: normalizeStatusLabel(v.defense, DEFAULT_STATUS_LABEL_MAP.defense),
    mentalResist: normalizeStatusLabel(v.mentalResist, DEFAULT_STATUS_LABEL_MAP.mentalResist),
    lifeResist: normalizeStatusLabel(v.lifeResist, DEFAULT_STATUS_LABEL_MAP.lifeResist),
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
    // 默认隐藏。首次进房间只有 launcher icon,Alt+S 或点击 icon 展开
    panelVisible: false,
    grid: normalizeGridConfig(undefined),
    gridOverlayVisible: false,
    statusLabelMap: normalizeStatusLabelMap(undefined),
    autoRotateAllyOnDown: true,
    combatFxEnabled: true,
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
    // panel 尺寸会随折叠 / 内容变化,调用方(useDraggable)测到实际 rect 后要传进来,
    // 否则 clampPanelPos 默认按 DEFAULT_PANEL_SIZE (320×360) 收紧,让折叠态拖不到底。
    setPanelPos(pos: PanelPos, panel?: Partial<PanelSize>) {
      this.panelPos = clampPanelPos(pos, { panel })
    },
    ensurePanelVisible(panel?: Partial<PanelSize>) {
      this.panelPos = clampPanelPos(this.panelPos, { panel })
    },
    togglePanelCollapsed() {
      this.panelCollapsed = !this.panelCollapsed
    },
    togglePanel() {
      this.panelVisible = !this.panelVisible
    },
    showPanel() {
      this.panelVisible = true
    },
    hidePanel() {
      this.panelVisible = false
    },
    // Settings tab 调它改 grid。patch 允许嵌套 originPx 部分更新(只给 x 不丢 y),
    // 最后统一走 normalizeGridConfig 把脏值(NaN / 0 / 负数 / 空串)回落到默认。
    setGrid(patch: Partial<GridConfig>) {
      const next: GridConfig = {
        ...this.grid,
        ...patch,
        originPx: {
          ...this.grid.originPx,
          ...(patch.originPx ?? {}),
        },
      }
      this.grid = normalizeGridConfig(next)
    },
    resetGrid() {
      this.grid = normalizeGridConfig(undefined)
    },
    setGridOverlayVisible(v: boolean) {
      this.gridOverlayVisible = v
    },
    setAutoRotateAllyOnDown(v: boolean) {
      this.autoRotateAllyOnDown = v
    },
    setCombatFxEnabled(v: boolean) {
      this.combatFxEnabled = v
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:settings',
    afterHydrate: ({ store }) => {
      const s = store as ReturnType<typeof useSettingsStore>
      // GM_setValue 里的值可能来自旧版本 / 手改 / 损坏,统一走一遍 normalizer。
      s.grid = normalizeGridConfig(s.grid)
      s.statusLabelMap = normalizeStatusLabelMap(s.statusLabelMap)
      s.ensurePanelVisible()
      bindSharedSettingsCrossTabSync(s)
    },
  },
})

// 跨 tab 同步:另一 tab 改设置时,本 tab 立即跟进。
// 注意只同步"全局/自动化"维度的字段(SHARED_FIELDS),per-tab UX 字段(panelPos / panelVisible /
// panelCollapsed / gridOverlayVisible 等)不同步,避免另一个 tab 把面板挪到自己用户视角下。
// remote=false 表示本 tab 自己写的,跳过以免自触发。
const SHARED_FIELDS = ['combatFxEnabled', 'autoRotateAllyOnDown'] as const
type SharedField = typeof SHARED_FIELDS[number]

function bindSharedSettingsCrossTabSync(store: ReturnType<typeof useSettingsStore>): void {
  if (typeof GM_addValueChangeListener !== 'function') {
    console.warn('[ccs] settings: GM_addValueChangeListener 不可用,settings 跨 tab 同步关闭')
    return
  }
  GM_addValueChangeListener('ccs:store:settings', (_k, _old, newValue, remote) => {
    if (!remote)
      return
    try {
      const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
      if (!parsed || typeof parsed !== 'object')
        return
      const next = parsed as Record<string, unknown>
      store.$patch((state) => {
        for (const key of SHARED_FIELDS) {
          const v = next[key]
          if (typeof v === 'boolean')
            (state as Record<SharedField, boolean>)[key] = v
        }
      })
    }
    catch (e) {
      console.warn('[ccs] settings: apply remote change failed', e)
    }
  })
}

declare function GM_addValueChangeListener(
  key: string,
  listener: (k: string, oldValue: unknown, newValue: unknown, remote: boolean) => void,
): number
