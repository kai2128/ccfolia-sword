import type { StatusLabelMap } from '@/core/status-slot'
import type { FxKind } from '@/infra/fx-bus'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { defineStore } from 'pinia'
import { extractParts } from '@/core/character/parts'
import { readStatusSlot } from '@/core/status-slot'
import { readStatusValue } from '@/core/status-slot/read'
import { readTagInstances } from '@/core/tag/read'
import { emitFx } from '@/infra/fx-bus'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'
import { diffActiveCharacters } from './diff-active-characters'
import { getReduxStore, subscribeSlice } from './redux-store'
import { makeResyncScheduler } from './resync-scheduler'
import { batchSetBuffsEnabledForCharacter } from './writers/batch-toggle-buff-enabled'
import { setCharacterAngle } from './writers/set-character-angle'

type RoomCharactersSlice = {
  ids: string[]
  entities: Record<string, CcfoliaCharacter>
} | undefined

function selectRoomCharacters(state: unknown): RoomCharactersSlice {
  return (state as { entities?: { roomCharacters?: RoomCharactersSlice } }).entities?.roomCharacters
}

function materialize(col: RoomCharactersSlice): CcfoliaCharacter[] {
  if (!col)
    return []
  const out: CcfoliaCharacter[] = []
  for (const id of col.ids) {
    const c = col.entities[id]
    if (c && c.active)
      out.push(c)
  }
  return out
}

export function extractRoomCharacters(state: unknown): CcfoliaCharacter[] {
  return materialize(selectRoomCharacters(state))
}

interface RoomCharactersState {
  list: CcfoliaCharacter[]
}

type AliveState = 'alive' | 'down'
type HpZeroState = 'alive' | 'down'

const ANGLE_DOWN = 90
const ANGLE_UP = 0

// snapshot 回放节流:burst 时最多每 50ms(~20fps)跑一次 resync,把 ccfolia
// 逐条回放(实测 ~73 次/秒)压下来,让出主线程给拖动/重绘。可按实测微调。
const RESYNC_THROTTLE_MS = 50

export const useRoomCharactersStore = defineStore('roomCharacters', {
  state: (): RoomCharactersState => ({ list: [] }),
  getters: {
    all: state => state.list,
    // id → character 索引。Pinia 按 list 反应性缓存,list 不变就复用同一个 Map。
    // 用它把 byId 从 O(N) 线性 find 降到 O(1) —— overlay 的 entries 里逐棋子查角色,
    // 否则整体是 O(N²),棋子一多拖动就卡。
    byIdMap(state): Map<string, CcfoliaCharacter> {
      const map = new Map<string, CcfoliaCharacter>()
      for (const c of state.list)
        map.set(c._id, c)
      return map
    },
    byId(): (characterId: string) => CcfoliaCharacter | undefined {
      return characterId => this.byIdMap.get(characterId)
    },
  },
  actions: {
    replace(list: CcfoliaCharacter[]) {
      this.list = list
    },
  },
})

let unsub: (() => void) | null = null
let bootstrapTimer: number | null = null
let scheduler: ReturnType<typeof makeResyncScheduler> | null = null
let aliveCache = new Map<string, AliveState>()
let hpZeroCache = new Map<string, HpZeroState>()
// 跨 tab FX 同步:每个客户端的 onSnapshot 都会推 HP 变化,各自跑 diff 喷自己 tab 的演出。
// cache 是"上一帧观察到的 HP 总和(累加多部位)";prev=undefined 的冷启动一帧只填 cache 不喷,
// 避免进房间时把所有现有 HP 当成 +N 治疗演一遍。
let hpFxCache = new Map<string, number>()
// MP FX 同 HP:cache 上一帧观察到的 MP 总和(累加多部位),冷启动一帧只填不喷。
let mpFxCache = new Map<string, number>()
// 上一帧的 active id→entity 快照。靠 RTK/Immer 引用复用做增量 diff:
// 没变的角色跨帧同引用,不进 changedSet,跳过昂贵 reconcile。
let prevActiveMap = new Map<string, CcfoliaCharacter>()

// 冷启动时 ccfolia Redux store 可能要几百 ms ~ 几秒才就位(用户先打开首页再进房间时尤其明显)。
// 和 composables/useCcfoliaCharacters 一致,用退避轮询直到 store 出现,subscribe 成功后立刻停轮询。
function stopBootstrap() {
  if (bootstrapTimer !== null) {
    window.clearInterval(bootstrapTimer)
    bootstrapTimer = null
  }
}

function classifyCharacter(character: CcfoliaCharacter): AliveState {
  if (character.invisible)
    return 'down'
  const labelMap = useSettingsStore().statusLabelMap
  const hp = readStatusValue(character.status, 'hp', labelMap)
  if (hp === null)
    return 'alive'
  return hp > 0 ? 'alive' : 'down'
}

function reconcileAliveDiff(list: CcfoliaCharacter[], changedSet: Set<string>) {
  for (const character of list) {
    if (!changedSet.has(character._id))
      continue
    const nextState = classifyCharacter(character)
    const previousState = aliveCache.get(character._id)
    aliveCache.set(character._id, nextState)
    if (previousState === undefined || previousState === nextState)
      continue
    batchSetBuffsEnabledForCharacter(character._id, nextState === 'alive').catch((error) => {
      console.error('[ccs] toggle buffs on alive-diff failed', error)
    })
  }
}

// 仅看 hp 是否 > 0,不掺 invisible —— 后者属于隐藏机制,不该触发倒地动作。
function classifyHpZero(character: CcfoliaCharacter): HpZeroState {
  const labelMap = useSettingsStore().statusLabelMap
  const hp = readStatusValue(character.status, 'hp', labelMap)
  if (hp === null)
    return 'alive'
  return hp > 0 ? 'alive' : 'down'
}

// tag 上的自动化 flag 取「任一开启」并集语义 —— 一个角色多个 tag 中只要有一个开启就触发。
function shouldAutoKnockdown(character: CcfoliaCharacter): boolean {
  const lib = useTagLibraryStore()
  return readTagInstances(character).some(t => lib.byId(t.definitionId)?.autoKnockdownOnHpZero === true)
}

// 多部位累加某个 slot(hp/mp)。多部位 char 在同一帧里两个部位反向变化(罕见)按净 delta 喷一次。
function totalSlot(character: CcfoliaCharacter, slot: 'hp' | 'mp', labelMap: StatusLabelMap): number {
  let sum = 0
  for (const part of extractParts(character, labelMap)) {
    const s = readStatusSlot(character.status, slot, labelMap, part.partKey)
    if (s)
      sum += s.value
  }
  return sum
}

// HP/MP 共用一套 diff 逻辑:按 slot 取总和,跟上一帧比,净 delta 喷对应方向的 FX。
// 关闭时直接清 cache 走人,redux 高频 tick 不再做 O(N×P) 的 status 扫描。
// 切回开启:第一帧 prev===undefined 静默重新填 cache,语义和首次进房间一致。
function reconcileSlotFxDiff(
  list: CcfoliaCharacter[],
  changedSet: Set<string>,
  slot: 'hp' | 'mp',
  cache: Map<string, number>,
  kinds: { up: FxKind, down: FxKind },
) {
  const settings = useSettingsStore()
  if (!settings.combatFxEnabled) {
    if (cache.size > 0)
      cache.clear()
    return
  }
  const labelMap = settings.statusLabelMap
  for (const character of list) {
    if (!changedSet.has(character._id))
      continue
    const next = totalSlot(character, slot, labelMap)
    const prev = cache.get(character._id)
    cache.set(character._id, next)
    if (prev === undefined)
      continue
    const delta = next - prev
    if (delta === 0)
      continue
    emitFx({
      kind: delta < 0 ? kinds.down : kinds.up,
      charId: character._id,
      amount: Math.abs(delta),
    })
  }
}

// 角色 HP 跨过 0 时旋转 token:倒地 -> 90°,复活 -> 0°。
// 触发条件改成"角色任一 tag 开启 autoKnockdownOnHpZero",取代原先 hard-coded 盟友 + 全局开关。
// 冷启动(prev === undefined)只填 cache 不写 Firestore,避免进房间时把已经躺着的角色再 set 一遍。
function reconcileTagKnockdownHpZeroDiff(list: CcfoliaCharacter[], changedSet: Set<string>) {
  for (const character of list) {
    if (!changedSet.has(character._id))
      continue
    const next = classifyHpZero(character)
    const prev = hpZeroCache.get(character._id)
    hpZeroCache.set(character._id, next)
    if (prev === undefined || prev === next)
      continue
    if (!shouldAutoKnockdown(character))
      continue
    const angle = next === 'down' ? ANGLE_DOWN : ANGLE_UP
    setCharacterAngle(character._id, angle).catch((error) => {
      console.error('[ccs] rotate on hp-zero failed', error)
    })
  }
}

// materialize + 三趟 reconcile + 写回 pinia(随后触发 Vue 重渲染)。
// 拖动棋子时 ccfolia 每帧派发多次 character/update,逐次跑这个会把开销放大到 60×/s。
// 角色离开 active 集合时,清掉它在各 diff cache 里的残留键,避免泄漏 + 过期 FX 基线。
function pruneCachesFor(removedIds: string[]) {
  for (const id of removedIds) {
    aliveCache.delete(id)
    hpZeroCache.delete(id)
    hpFxCache.delete(id)
    mpFxCache.delete(id)
  }
}

function resync(pinia: ReturnType<typeof useRoomCharactersStore>, slice: RoomCharactersSlice) {
  const list = materialize(slice)
  const { changedIds, removedIds, membershipChanged } = diffActiveCharacters(prevActiveMap, list)

  // no-op 短路:active 子集这帧没动、成员也没增减 → 不 replace、不 reconcile,
  // 下游 pieces.list / overlay entries / roster 因引用未变完全不触发。
  if (changedIds.length === 0 && !membershipChanged)
    return

  // 重建上一帧快照(下次 diff 用)
  const nextMap = new Map<string, CcfoliaCharacter>()
  for (const c of list)
    nextMap.set(c._id, c)
  prevActiveMap = nextMap

  pruneCachesFor(removedIds)

  pinia.replace(list)

  const changedSet = new Set(changedIds)
  reconcileAliveDiff(list, changedSet)
  reconcileTagKnockdownHpZeroDiff(list, changedSet)
  reconcileSlotFxDiff(list, changedSet, 'hp', hpFxCache, { up: 'heal', down: 'damage' })
  reconcileSlotFxDiff(list, changedSet, 'mp', mpFxCache, { up: 'mp-restore', down: 'mp-drain' })
}

// 用 rAF 把一帧内的多次 store 通知合并成一次重算;fire 时读最新 state,保证不丢更新。
function getScheduler() {
  if (!scheduler) {
    scheduler = makeResyncScheduler({
      now: () => performance.now(),
      requestFrame: cb => window.requestAnimationFrame(cb),
      cancelFrame: h => window.cancelAnimationFrame(h),
      setTimer: (cb, ms) => window.setTimeout(cb, ms),
      clearTimer: h => window.clearTimeout(h),
      run: () => {
        const store = getReduxStore()
        if (!store)
          return
        resync(useRoomCharactersStore(), selectRoomCharacters(store.getState()))
      },
    }, RESYNC_THROTTLE_MS)
  }
  return scheduler
}

// 用节流调度器把一段时间内的多次 store 通知合并成有限频率的 resync。
function scheduleResync() {
  getScheduler().notify()
}

function trySubscribe(): boolean {
  if (unsub)
    return true
  const store = getReduxStore()
  if (!store)
    return false
  const pinia = useRoomCharactersStore()
  // 冷启动同步跑一次,先把 alive/hp-zero/fx cache 填好;后续通知走 rAF 合并。
  resync(pinia, selectRoomCharacters(store.getState()))
  unsub = subscribeSlice(
    store,
    selectRoomCharacters,
    () => scheduleResync(),
    { emitInitial: false },
  )
  stopBootstrap()
  return true
}

export function startRoomCharactersSync(bootstrapIntervalMs = 1000): void {
  if (unsub || bootstrapTimer !== null)
    return
  if (trySubscribe())
    return
  bootstrapTimer = window.setInterval(() => {
    trySubscribe()
  }, bootstrapIntervalMs)
}

export function stopRoomCharactersSync(): void {
  stopBootstrap()
  scheduler?.cancel()
  scheduler = null
  unsub?.()
  unsub = null
  aliveCache = new Map()
  hpZeroCache = new Map()
  hpFxCache = new Map()
  mpFxCache = new Map()
  prevActiveMap = new Map()
}
