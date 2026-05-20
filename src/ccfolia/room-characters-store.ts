import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { defineStore } from 'pinia'
import { extractParts } from '@/core/character/parts'
import { readStatusSlot } from '@/core/status-slot'
import { readStatusValue } from '@/core/status-slot/read'
import { readTagInstances } from '@/core/tag/read'
import { emitFx } from '@/infra/fx-bus'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'
import { getReduxStore, subscribeSlice } from './redux-store'
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
let resyncRafId: number | null = null
let aliveCache = new Map<string, AliveState>()
let hpZeroCache = new Map<string, HpZeroState>()
// 跨 tab FX 同步:每个客户端的 onSnapshot 都会推 HP 变化,各自跑 diff 喷自己 tab 的演出。
// cache 是"上一帧观察到的 HP 总和(累加多部位)";prev=undefined 的冷启动一帧只填 cache 不喷,
// 避免进房间时把所有现有 HP 当成 +N 治疗演一遍。
let hpFxCache = new Map<string, number>()

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

function reconcileAliveDiff(list: CcfoliaCharacter[]) {
  for (const character of list) {
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

// 多部位累加 HP。多部位 char 在同一帧里两个部位反向变化(罕见)按净 delta 喷一次。
function totalHp(character: CcfoliaCharacter, labelMap: StatusLabelMap): number {
  let sum = 0
  for (const part of extractParts(character, labelMap)) {
    const slot = readStatusSlot(character.status, 'hp', labelMap, part.partKey)
    if (slot)
      sum += slot.value
  }
  return sum
}

function reconcileHpFxDiff(list: CcfoliaCharacter[]) {
  const settings = useSettingsStore()
  // 关闭时直接清 cache 走人,redux 高频 tick 不再做 O(N×P) 的 status 扫描。
  // 切回开启:第一帧 prev===undefined 静默重新填 cache,语义和首次进房间一致。
  if (!settings.combatFxEnabled) {
    if (hpFxCache.size > 0)
      hpFxCache.clear()
    return
  }
  const labelMap = settings.statusLabelMap
  for (const character of list) {
    const next = totalHp(character, labelMap)
    const prev = hpFxCache.get(character._id)
    hpFxCache.set(character._id, next)
    if (prev === undefined)
      continue
    const delta = next - prev
    if (delta === 0)
      continue
    emitFx({
      kind: delta < 0 ? 'damage' : 'heal',
      charId: character._id,
      amount: Math.abs(delta),
    })
  }
}

// 角色 HP 跨过 0 时旋转 token:倒地 -> 90°,复活 -> 0°。
// 触发条件改成"角色任一 tag 开启 autoKnockdownOnHpZero",取代原先 hard-coded 盟友 + 全局开关。
// 冷启动(prev === undefined)只填 cache 不写 Firestore,避免进房间时把已经躺着的角色再 set 一遍。
function reconcileTagKnockdownHpZeroDiff(list: CcfoliaCharacter[]) {
  for (const character of list) {
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
function resync(pinia: ReturnType<typeof useRoomCharactersStore>, slice: RoomCharactersSlice) {
  pinia.replace(materialize(slice))
  reconcileAliveDiff(pinia.list)
  reconcileTagKnockdownHpZeroDiff(pinia.list)
  reconcileHpFxDiff(pinia.list)
}

// 用 rAF 把一帧内的多次 store 通知合并成一次重算;fire 时读最新 state,保证不丢更新。
function scheduleResync() {
  if (resyncRafId !== null)
    return
  resyncRafId = window.requestAnimationFrame(() => {
    resyncRafId = null
    const store = getReduxStore()
    if (!store)
      return
    resync(useRoomCharactersStore(), selectRoomCharacters(store.getState()))
  })
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
  if (resyncRafId !== null) {
    window.cancelAnimationFrame(resyncRafId)
    resyncRafId = null
  }
  unsub?.()
  unsub = null
  aliveCache = new Map()
  hpZeroCache = new Map()
  hpFxCache = new Map()
}
