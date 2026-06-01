import type { CcfoliaCharacter } from '@/types/ccfolia'
import { useCcfoliaSelectionStore } from '@/ccfolia/ccfolia-selection-store'
import { extractRoomCharacters } from '@/ccfolia/room-characters-store'
import { createLogger } from '@/infra/log'
import { useSettingsStore } from '@/stores/settings'
import { getReduxStore, subscribeSlice } from './redux-store'
import { snapCharacterToGrid } from './writers/snap-character-to-grid'

const log = createLogger('snap-grid')

let unsub: (() => void) | null = null
let bootstrapTimer: number | null = null
// 上一次见到的坐标,用来判断"这次到底哪个角色动了"。
const prevPos = new Map<string, { x: number, y: number }>()

function posOf(c: CcfoliaCharacter): { x: number, y: number } | null {
  if (typeof c.x !== 'number' || typeof c.y !== 'number')
    return null
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y))
    return null
  return { x: c.x, y: c.y }
}

function onChars(chars: CcfoliaCharacter[]): void {
  const settings = useSettingsStore()
  // 吸附开 + 网格可见才生效(网格隐藏时不吸附)。
  const enabled = settings.snapToGrid && settings.gridOverlayVisible
  const selected = useCcfoliaSelectionStore().selectedCharacterIds
  const seen = new Set<string>()

  for (const c of chars) {
    const id = c._id
    seen.add(id)
    const cur = posOf(c)
    if (!cur)
      continue
    const prev = prevPos.get(id)
    const moved = !prev || prev.x !== cur.x || prev.y !== cur.y
    // 先更新缓存,保证下一轮 diff 干净 —— 即便这次不吸附也要记下新位置。
    prevPos.set(id, cur)
    if (!enabled || !moved || !selected.has(id))
      continue
    // 直接把这个"新鲜"的 Redux 角色实体传给 writer —— 不能让 writer 回读节流镜像 store,
    // 否则拿到拖动前的旧坐标(bug:不吸附 / 被拉回原位)。
    // 异步写回;失败只记日志,不阻塞订阅。
    snapCharacterToGrid(c, settings.grid).catch((e) => {
      log.error('snap failed', { id, error: e instanceof Error ? e.message : String(e) })
    })
  }
  // 清掉已消失的角色,避免 map 膨胀。
  for (const id of [...prevPos.keys()]) {
    if (!seen.has(id))
      prevPos.delete(id)
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
}
