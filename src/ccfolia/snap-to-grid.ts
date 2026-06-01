import type { GridConfig } from '@/core/range/types'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { useCcfoliaSelectionStore } from '@/ccfolia/ccfolia-selection-store'
import { extractRoomCharacters } from '@/ccfolia/room-characters-store'
import { createLogger } from '@/infra/log'
import { useSettingsStore } from '@/stores/settings'
import { getReduxStore, subscribeSlice } from './redux-store'
import { computeSnapWrite, writeSnappedPosition } from './writers/snap-character-to-grid'

const log = createLogger('snap-grid')

let unsub: (() => void) | null = null
let bootstrapTimer: number | null = null
// 上一次见到的坐标,用来判断"这次到底哪个角色动了"。
const prevPos = new Map<string, { x: number, y: number }>()
// 防再入:我们自己的乐观写入会同步触发 Redux 通知,从而同步重入 onChars。
// 批量拖动时这会变成 N 层递归 + O(N²) 重扫,卡死主线程。applying 期间直接忽略通知。
let applying = false

export interface SnapTarget {
  char: CcfoliaCharacter
  target: { x: number, y: number }
}

function posOf(c: CcfoliaCharacter): { x: number, y: number } | null {
  if (typeof c.x !== 'number' || typeof c.y !== 'number')
    return null
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y))
    return null
  return { x: c.x, y: c.y }
}

// 纯逻辑:扫一遍角色,顺手更新 prevPos,挑出需要吸附的(开关开 + 真移动 + 本地选中 + 有合法落点)。
// 关键:把"落点"也写回 prevPos —— 这样我们自己的写入回流(onSnapshot/乐观)时 moved=false,
// 不会被当成新移动重复处理。prevPos 会被原地修改。
export function collectSnaps(
  chars: CcfoliaCharacter[],
  prev: Map<string, { x: number, y: number }>,
  opts: { enabled: boolean, selected: Set<string>, grid: GridConfig },
): SnapTarget[] {
  const seen = new Set<string>()
  const out: SnapTarget[] = []
  for (const c of chars) {
    const id = c._id
    seen.add(id)
    const cur = posOf(c)
    if (!cur)
      continue
    const last = prev.get(id)
    const moved = !last || last.x !== cur.x || last.y !== cur.y
    prev.set(id, cur)
    if (!opts.enabled || !moved || !opts.selected.has(id))
      continue
    const target = computeSnapWrite({ x: c.x, y: c.y, width: c.width, height: c.height }, opts.grid)
    if (!target)
      continue
    prev.set(id, target)
    out.push({ char: c, target })
  }
  // 清掉已消失的角色,避免 map 膨胀。
  for (const id of [...prev.keys()]) {
    if (!seen.has(id))
      prev.delete(id)
  }
  return out
}

function onChars(chars: CcfoliaCharacter[]): void {
  if (applying)
    return // 屏蔽我们自己乐观写入触发的同步再入

  const settings = useSettingsStore()
  // 吸附开 + 网格可见才生效(网格隐藏时不吸附)。
  const enabled = settings.snapToGrid && settings.gridOverlayVisible
  const selected = useCcfoliaSelectionStore().selectedCharacterIds
  const toSnap = collectSnaps(chars, prevPos, { enabled, selected, grid: settings.grid })
  if (toSnap.length === 0)
    return

  // 批量并行写回。applying 把这一批写入触发的同步通知挡在门外,杜绝递归雪崩。
  applying = true
  try {
    for (const { char, target } of toSnap) {
      void writeSnappedPosition(char, target).catch((e) => {
        log.error('snap failed', { id: char._id, error: e instanceof Error ? e.message : String(e) })
      })
    }
  }
  finally {
    applying = false
  }
}

function stopBootstrap() {
  if (bootstrapTimer !== null) {
    window.clearInterval(bootstrapTimer)
    bootstrapTimer = null
  }
}

function trySubscribe(): boolean {
  if (unsub)
    return true
  const store = getReduxStore()
  if (!store)
    return false
  // 先 seed 当前坐标,避免启动瞬间把所有人当成"刚移动"。
  for (const c of extractRoomCharacters(store.getState())) {
    const p = posOf(c)
    if (p)
      prevPos.set(c._id, p)
  }
  unsub = subscribeSlice(
    store,
    extractRoomCharacters,
    onChars,
    { emitInitial: false },
  )
  stopBootstrap()
  return true
}

export function startSnapToGrid(bootstrapIntervalMs = 1000): void {
  if (unsub || bootstrapTimer !== null)
    return
  if (trySubscribe())
    return
  bootstrapTimer = window.setInterval(() => {
    trySubscribe()
  }, bootstrapIntervalMs)
}

export function stopSnapToGrid(): void {
  stopBootstrap()
  unsub?.()
  unsub = null
  prevPos.clear()
  applying = false
}
