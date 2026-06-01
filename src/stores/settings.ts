// 用户偏好 store。持久化的 UI 状态也塞这里 —— 面板位置 / 是否折叠。
import type { GridConfig } from '@/core/range'
import type { StatusLabelMap } from '@/core/status-slot'
import { defineStore } from 'pinia'
import { DEFAULT_GRID_CONFIG } from '@/core/range'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'
import { bindGmCrossTabSync } from '@/infra/gm-cross-tab'
import { setRingSize } from '@/infra/log'
import { createDebouncedGmStorage } from '@/infra/pinia-persist-adapter'

export interface PanelPos {
  x: number
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

export type GridColor = 'white' | 'black'

interface SettingsState {
  defaultPowerTableId: string | null
  logMaxLines: number
  theme: 'light' | 'dark' | 'auto'
  panelPos: PanelPos
  panelCollapsed: boolean
  panelVisible: boolean
  grid: GridConfig
  gridOverlayVisible: boolean
  // 网格坐标标签开关 + 网格整体透明度(线条与标签共用)
  gridLabelsVisible: boolean
  gridOpacity: number
  // 网格线条与标签的颜色,深色背景用 white、浅色背景用 black
  gridColor: GridColor
  // 拖动棋子松手后吸附到格子。与 gridOverlayVisible 单向联动(显隐网格会带动它,反之不动)。
  snapToGrid: boolean
  statusLabelMap: StatusLabelMap
  combatFxEnabled: boolean
  // 角色密集时把单部位 C 自动降级为 E,避免遮挡。设置面板可关。
  autoSwitchOnCrowded: boolean
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

// 透明度脏值(NaN / 越界)统一夹到 [0,1],默认回落 0.35。
function clampOpacity(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n))
    return 0.35
  return Math.min(1, Math.max(0, n))
}

// 颜色脏值统一回落 white。
function normalizeGridColor(raw: unknown): GridColor {
  return raw === 'black' ? 'black' : 'white'
}

function normalizeGridConfig(raw: unknown): GridConfig {
  const v = (raw && typeof raw === 'object') ? raw as Partial<GridConfig> : {}
  const origin = (v.originPx && typeof v.originPx === 'object')
    ? v.originPx as Partial<GridConfig['originPx']>
    : {}
  return {
    cols: normalizeLength(Number(v.cols ?? Number.NaN), DEFAULT_GRID_CONFIG.cols),
    rows: normalizeLength(Number(v.rows ?? Number.NaN), DEFAULT_GRID_CONFIG.rows),
    gridSize: normalizeLength(Number(v.gridSize ?? Number.NaN), DEFAULT_GRID_CONFIG.gridSize),
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
    gridLabelsVisible: true,
    gridOpacity: 0.4,
    gridColor: 'white',
    snapToGrid: true,
    statusLabelMap: normalizeStatusLabelMap(undefined),
    combatFxEnabled: true,
    autoSwitchOnCrowded: true,
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
    // 吸附是独立偏好,不与网格可见性联动。但实际生效还要求网格可见 —— 见 snap-to-grid 控制器。
    setSnapToGrid(v: boolean) {
      this.snapToGrid = v
    },
    setGridLabelsVisible(v: boolean) {
      this.gridLabelsVisible = v
    },
    setGridOpacity(n: number) {
      this.gridOpacity = clampOpacity(n)
    },
    setGridColor(c: GridColor) {
      this.gridColor = normalizeGridColor(c)
    },
    setCombatFxEnabled(v: boolean) {
      this.combatFxEnabled = v
    },
    setAutoSwitchOnCrowded(v: boolean) {
      this.autoSwitchOnCrowded = v
    },
  },
  persist: {
    // 去抖 200ms:拖动 slider 等高频写入合并成尾帧一次广播,避免多 tab 回弹竞态。
    storage: createDebouncedGmStorage(200),
    key: 'ccs:store:settings',
    afterHydrate: ({ store }) => {
      const s = store as ReturnType<typeof useSettingsStore>
      // GM_setValue 里的值可能来自旧版本 / 手改 / 损坏,统一走一遍 normalizer。
      s.grid = normalizeGridConfig(s.grid)
      s.gridOpacity = clampOpacity(s.gridOpacity)
      s.gridColor = normalizeGridColor(s.gridColor)
      s.snapToGrid = s.snapToGrid === true
      s.statusLabelMap = normalizeStatusLabelMap(s.statusLabelMap)
      s.ensurePanelVisible()
      bindSharedSettingsCrossTabSync(s)
    },
  },
})

// 跨 tab 同步"全局/自动化/网格显示"维度的字段。真正 per-tab 的 UX
// (panelPos / panelVisible / panelCollapsed)不同步 —— 否则一个 tab 拖动面板会把另一个 tab 的视图也拽走。
const SHARED_FIELDS = [
  'combatFxEnabled',
  'autoSwitchOnCrowded',
  'gridOverlayVisible',
  'gridLabelsVisible',
  'gridOpacity',
  'gridColor',
  'snapToGrid',
] as const
type SharedField = typeof SHARED_FIELDS[number]

function bindSharedSettingsCrossTabSync(store: ReturnType<typeof useSettingsStore>): void {
  bindGmCrossTabSync<Record<string, unknown>>(
    'ccs:store:settings',
    (parsed) => {
      if (typeof parsed !== 'object')
        return
      // 先收集真正发生变化的字段,再 $patch。空 patch 也会触发 persist 插件的 $subscribe,
      // 写回 GM 后远端再回弹,可能形成事件回路。
      const updates: Partial<Record<SharedField, boolean | number | string>> = {}
      for (const key of SHARED_FIELDS) {
        const v = parsed[key]
        // 只接受与当前值同类型的有效值(boolean / 有限 number / 非空 string),挡掉旧版本 / 脏数据。
        // 源 tab 写入前已经 clamp 过 gridOpacity、normalize 过 gridColor,这里信源端即可。
        const ok = typeof v === typeof store[key]
          && (typeof v === 'boolean'
            || (typeof v === 'number' && Number.isFinite(v))
            || (typeof v === 'string' && v.length > 0))
        if (ok && store[key] !== v)
          updates[key] = v as boolean | number | string
      }
      if (Object.keys(updates).length === 0)
        return
      // updates 把每个字段都标成 boolean | number,$patch 要的是各字段精确类型,这里收窄。
      store.$patch(updates as Partial<SettingsState>)
    },
    'settings',
  )
}
