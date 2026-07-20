<script setup lang="ts">
// 测距叠加层。挂在高 z(z=9999,棋子之上)的 SceneOverlayRoot 里,所以能收到棋子上方的点击、
// 线与标注也画在棋子之上。仅 ruler.active 时渲染。
//
// 视觉走 Claude Design「ruler A · 克制」方案:测距金(amber)色系,刻意区别于 HP/MP/阵营。
// 累计 = 实心金牌;段增量 = +N 深底牌;直线 = 直 深底牌;节点分 start/mid/end。
//
// 坐标:host 在 ccfolia 的 transform:scale 相机层里,用世界坐标。捕获层与 SVG 都 translate 到 originPx,
// 内部按「相对原点」画。点击用 offsetX/offsetY(元素本地坐标,不受 CSS scale 影响)→ floor(offset/cellSize) 取格。
import type { CellRef } from '@/core/range'
import { computed, onUnmounted, ref, watch } from 'vue'
import { chebyshev, orthoRoute, routeMarkers } from '@/core/range'
import { useRulerStore } from '@/stores/ruler'
import { useSettingsStore } from '@/stores/settings'

// 测距金:amber 主色 / glow 高光 / deep 阴影 / cell 走位格填充。
const GOLD = {
  amber: '#e0973a',
  glow: '#f6c069',
  deep: '#a86a22',
  cell: 'rgba(224,151,58,.15)',
  chipBg: 'rgba(11,18,36,.86)',
  chipBorder: 'rgba(224,151,58,.6)',
  node: 'rgba(11,18,36,.95)',
}

const ruler = useRulerStore()
const settings = useSettingsStore()

const hover = ref<CellRef | null>(null)
const captureEl = ref<HTMLElement | null>(null)

// 测距模式里,在 window 捕获阶段(先于 ccfolia)吞掉落在捕获层上的右键 / 双击,
// 免得点到棋子弹出 ccfolia 的菜单 / 编辑框。右键顺手当「结束当前」。
const GUARD_TYPES = ['contextmenu', 'dblclick', 'auxclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup']
function onGuard(e: Event): void {
  const el = captureEl.value
  if (!el)
    return
  const path = typeof e.composedPath === 'function' ? e.composedPath() : []
  if (!path.includes(el))
    return // 只拦捕获层区域内的,面板/其它 UI 放行
  if (e.type === 'contextmenu') {
    e.preventDefault()
    e.stopImmediatePropagation()
    ruler.finishCurrent() // 右键 = 结束当前
    return
  }
  if (e.type === 'dblclick') {
    e.preventDefault()
    e.stopImmediatePropagation()
    return
  }
  if ((e as MouseEvent).button === 2)
    e.stopImmediatePropagation() // 右键 down/up:吞传播,保留 contextmenu 生成
}
watch(() => ruler.active, (on) => {
  for (const t of GUARD_TYPES) {
    if (on)
      window.addEventListener(t, onGuard, true)
    else
      window.removeEventListener(t, onGuard, true)
  }
}, { immediate: true })
onUnmounted(() => {
  for (const t of GUARD_TYPES)
    window.removeEventListener(t, onGuard, true)
})

const grid = computed(() => settings.grid)
const totalW = computed(() => grid.value.cols * grid.value.cellSizePx)
const totalH = computed(() => grid.value.rows * grid.value.cellSizePx)
const transform = computed(() => `translate(${grid.value.originPx.x}px, ${grid.value.originPx.y}px)`)

const sameCell = (a: CellRef, b: CellRef): boolean => a.col === b.col && a.row === b.row

// 进行中路径 = current +(有 hover 且与末点不同时)预览到 hover 的一段。
const livePath = computed<CellRef[]>(() => {
  const cur = ruler.current
  const h = hover.value
  if (h && cur.length && !sameCell(h, cur[cur.length - 1]))
    return [...cur, h]
  return cur
})

type ChipKind = 'total' | 'seg' | 'direct'
interface Chip { x: number, y: number, w: number, h: number, rx: number, fs: number, weight: number, kind: ChipKind, text: string, prefix?: string }
type NodeRole = 'start' | 'mid' | 'end'
interface Model {
  key: string
  dim: boolean // 已结束的测量整体压暗
  cells: { x: number, y: number }[]
  route: { x: number, y: number }[] // 正交走位折线(半透)
  line: { x1: number, y1: number, x2: number, y2: number } | null
  turns: { x: number, y: number }[]
  nodes: { x: number, y: number, role: NodeRole }[]
  chips: Chip[]
}

function centerPx(c: CellRef): { x: number, y: number } {
  const s = grid.value.cellSizePx
  return { x: c.col * s + s / 2, y: c.row * s + s / 2 }
}

// 标签牌:尺寸随 cellSizePx 缩放。CJK(直)比 ASCII 宽。
function chip(kind: ChipKind, x: number, y: number, fs: number, weight: number, text: string, prefix?: string): Chip {
  let cjk = prefix ? 1 : 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x3400 && code <= 0x9FFF)
      cjk++
  }
  const w = (text.length - (prefix ? 0 : cjk)) * 0.6 * fs + (prefix ? 1.3 * fs : 0) + cjk * 1.05 * fs + fs
  return { kind, x, y, fs, weight, text, prefix, w, h: fs * 1.5, rx: fs * 0.42 }
}

function build(points: CellRef[], done: boolean, key: string): Model {
  const s = grid.value.cellSizePx
  const fsSeg = s * 0.24
  const fsTot = s * 0.28

  const routeCells = orthoRoute(points)
  const seen = new Set<string>()
  const cells: { x: number, y: number }[] = []
  for (const c of routeCells) {
    const k = `${c.col},${c.row}`
    if (seen.has(k))
      continue
    seen.add(k)
    cells.push({ x: c.col * s, y: c.row * s })
  }
  const route = points.length >= 2 ? routeCells.map(centerPx) : []

  const chips: Chip[] = []
  const turns: { x: number, y: number }[] = []
  let line: Model['line'] = null

  if (points.length >= 2) {
    const a = points[0]
    const z = points[points.length - 1]
    const ca = centerPx(a)
    const cz = centerPx(z)
    line = { x1: ca.x, y1: ca.y, x2: cz.x, y2: cz.y }
    chips.push(chip('direct', (ca.x + cz.x) / 2, (ca.y + cz.y) / 2, fsSeg, 600, `${chebyshev(a, z)}m`, '直'))

    const vert = new Set(points.map(p => `${p.col},${p.row}`))
    for (const m of routeMarkers(points)) {
      const cm = centerPx(m.cell)
      const cf = centerPx(m.from)
      chips.push(chip('total', cm.x, cm.y + s * 0.42, fsTot, 700, `${m.cumulative}m`)) // 累计金牌
      chips.push(chip('seg', (cf.x + cm.x) / 2, (cf.y + cm.y) / 2, fsSeg, 500, `+${m.segment}m`)) // 段增量
      if (!vert.has(`${m.cell.col},${m.cell.row}`)) // 自动拐点(非点击落点)才画小转点
        turns.push(cm)
    }
  }

  const nodes = points.map((p, i): Model['nodes'][number] => ({
    ...centerPx(p),
    role: i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'mid',
  }))

  return { key, dim: done, cells, route, line, turns, nodes, chips }
}

function polyPoints(pts: { x: number, y: number }[]): string {
  return pts.map(p => `${p.x},${p.y}`).join(' ')
}

const models = computed<Model[]>(() => {
  const out = ruler.finished.map((p, i) => build(p, true, `f${i}`))
  const live = livePath.value
  if (live.length)
    out.push(build(live, false, 'cur'))
  return out
})

function cellFromEvent(e: MouseEvent): CellRef {
  const s = grid.value.cellSizePx || 1
  const col = Math.min(grid.value.cols - 1, Math.max(0, Math.floor(e.offsetX / s)))
  const row = Math.min(grid.value.rows - 1, Math.max(0, Math.floor(e.offsetY / s)))
  return { col, row }
}

function onClick(e: MouseEvent): void {
  const cell = cellFromEvent(e)
  const cur = ruler.current
  // 点最后一个点再点一次 = 结束当前(与右键并存)。
  if (cur.length && sameCell(cell, cur[cur.length - 1])) {
    ruler.finishCurrent()
    return
  }
  ruler.addPoint(cell)
}
function onMove(e: MouseEvent): void {
  hover.value = cellFromEvent(e)
}
function onLeave(): void {
  hover.value = null
}
</script>

<template>
  <div v-if="ruler.active" class="pointer-events-none absolute inset-0">
    <!-- 透明捕获层:仅 active 时铺在 grid 区域,pointer-events 打开吃点击 -->
    <div
      ref="captureEl"
      class="pointer-events-auto absolute left-0 top-0 cursor-crosshair"
      :style="{ transform, width: `${totalW}px`, height: `${totalH}px` }"
      @click="onClick"
      @mousemove="onMove"
      @mouseleave="onLeave"
    />
    <!-- 渲染层:不吃事件 -->
    <svg
      class="pointer-events-none absolute left-0 top-0"
      :width="totalW"
      :height="totalH"
      :style="{ transform, overflow: 'visible' }"
    >
      <defs>
        <linearGradient id="ruler-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6c069" />
          <stop offset="1" stop-color="#a86a22" />
        </linearGradient>
        <radialGradient id="ruler-start" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stop-color="#f6c069" />
          <stop offset="0.55" stop-color="#e0973a" />
          <stop offset="1" stop-color="#a86a22" />
        </radialGradient>
      </defs>

      <g v-for="m in models" :key="m.key" :opacity="m.dim ? 0.6 : 1">
        <!-- 走位格高亮 -->
        <rect
          v-for="(c, i) in m.cells"
          :key="`${m.key}-c${i}`"
          :x="c.x"
          :y="c.y"
          :width="grid.cellSizePx"
          :height="grid.cellSizePx"
          :fill="GOLD.cell"
        />
        <!-- 格路径:正交走位折线(半透) -->
        <polyline
          v-if="m.route.length"
          :points="polyPoints(m.route)"
          fill="none"
          :stroke="GOLD.amber"
          :stroke-width="grid.cellSizePx * 0.05"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.5"
        />
        <!-- direct 直线(虚线 + 辉光) -->
        <line
          v-if="m.line"
          :x1="m.line.x1"
          :y1="m.line.y1"
          :x2="m.line.x2"
          :y2="m.line.y2"
          :stroke="GOLD.amber"
          :stroke-width="grid.cellSizePx * 0.045"
          stroke-dasharray="7 5"
          stroke-linecap="round"
          opacity="0.85"
          :style="{ filter: `drop-shadow(0 0 4px ${GOLD.amber}88)` }"
        />
        <!-- 自动拐点小转点 -->
        <circle
          v-for="(t, i) in m.turns"
          :key="`${m.key}-t${i}`"
          :cx="t.x"
          :cy="t.y"
          :r="grid.cellSizePx * 0.06"
          :fill="GOLD.node"
          :stroke="GOLD.amber"
          stroke-width="1.5"
        />
        <!-- 节点:start 金点 / mid 金环 / end 十字准星 -->
        <template v-for="(n, i) in m.nodes" :key="`${m.key}-n${i}`">
          <g v-if="n.role === 'end'" :transform="`translate(${n.x}, ${n.y})`">
            <circle
              :r="grid.cellSizePx * 0.28"
              fill="none"
              :stroke="GOLD.amber"
              stroke-width="1.6"
              stroke-dasharray="3 3.5"
              opacity="0.9"
            />
            <circle :r="grid.cellSizePx * 0.09" fill="none" :stroke="GOLD.glow" stroke-width="1.4" />
            <g :stroke="GOLD.glow" stroke-width="1.5" stroke-linecap="round">
              <line x1="0" :y1="-grid.cellSizePx * 0.34" x2="0" :y2="-grid.cellSizePx * 0.2" />
              <line x1="0" :y1="grid.cellSizePx * 0.34" x2="0" :y2="grid.cellSizePx * 0.2" />
              <line :x1="-grid.cellSizePx * 0.34" y1="0" :x2="-grid.cellSizePx * 0.2" y2="0" />
              <line :x1="grid.cellSizePx * 0.34" y1="0" :x2="grid.cellSizePx * 0.2" y2="0" />
            </g>
          </g>
          <circle
            v-else-if="n.role === 'start'"
            :cx="n.x"
            :cy="n.y"
            :r="grid.cellSizePx * 0.16"
            fill="url(#ruler-start)"
            stroke="rgba(11,18,36,.9)"
            stroke-width="2"
            :style="{ filter: `drop-shadow(0 0 6px ${GOLD.amber}aa)` }"
          />
          <circle
            v-else
            :cx="n.x"
            :cy="n.y"
            :r="grid.cellSizePx * 0.11"
            :fill="GOLD.node"
            :stroke="GOLD.amber"
            stroke-width="2"
          />
        </template>
        <!-- 标签牌 -->
        <g v-for="(ch, i) in m.chips" :key="`${m.key}-l${i}`" :transform="`translate(${ch.x}, ${ch.y})`">
          <rect
            :x="-ch.w / 2"
            :y="-ch.h / 2"
            :width="ch.w"
            :height="ch.h"
            :rx="ch.rx"
            :fill="ch.kind === 'total' ? 'url(#ruler-gold)' : GOLD.chipBg"
            :stroke="ch.kind === 'total' ? GOLD.glow : GOLD.chipBorder"
            stroke-width="1"
          />
          <text
            x="0"
            y="0"
            text-anchor="middle"
            dominant-baseline="central"
            font-family="'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
            :font-size="ch.fs"
            :font-weight="ch.weight"
            :fill="ch.kind === 'total' ? '#160c04' : GOLD.glow"
            style="font-variant-numeric: tabular-nums; letter-spacing: .02em"
          >
            <template v-if="ch.prefix">
              <tspan font-family="'Noto Serif SC', serif" font-weight="700" :font-size="ch.fs * 0.92">{{ ch.prefix }}</tspan><tspan :dx="ch.fs * 0.22">{{ ch.text }}</tspan>
            </template>
            <template v-else>{{ ch.text }}</template>
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
