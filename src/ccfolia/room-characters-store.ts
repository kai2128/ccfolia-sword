import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { defineStore } from 'pinia'
import { extractParts } from '@/core/character/parts'
import { pieceBottomCenter, pxToCell } from '@/core/range'
import { readStatusSlot } from '@/core/status-slot'
import { readStatusValue } from '@/core/status-slot/read'
import { readTagInstances } from '@/core/tag/read'
import { emitFx } from '@/infra/fx-bus'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'
import { getReduxStore, subscribeSlice } from './redux-store'
import { batchSetBuffsEnabledForCharacter } from './writers/batch-toggle-buff-enabled'
import { restoreHpMpToMax } from './writers/restore-hp-mp-to-max'
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
// 与 useOnCanvasIds.ts 保持一致:脚下落在 cell 底边时回缩 eps,避免被 floor 推到下一格。
const CELL_BOUNDARY_EPS = 0.001

export const useRoomCharactersStore = defineStore('roomCharacters', {
  state: (): RoomCharactersState => ({ list: [] }),
  getters: {
    all: state => state.list,
    byId: state => (characterId: string): CcfoliaCharacter | undefined =>
      state.list.find(c => c._id === characterId),
  },
  actions: {
    replace(list: CcfoliaCharacter[]) {
      this.list = list
    },
  },
})

let unsub: (() => void) | null = null
let bootstrapTimer: number | null = null
let aliveCache = new Map<string, AliveState>()
let hpZeroCache = new Map<string, HpZeroState>()
// 角色是否在主板格网内:true=脚下落在格内,false=离开格网(或被 GM 隐藏)。
// prev === undefined 静默冷启动,避免进房间时把现成「在场外」的角色立刻回血一遍。
let onCanvasCache = new Map<string, boolean>()
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

function shouldAutoRestoreOnMoveOutside(character: CcfoliaCharacter): boolean {
  const lib = useTagLibraryStore()
  return readTagInstances(character).some(t => lib.byId(t.definitionId)?.autoRestoreOnMoveOutside === true)
}

// "在画布上"判定与 useOnCanvasIds 一致:invisible 算离场;脚下底边中点回缩 eps 后落在格网内才算 on。
function classifyOnCanvas(character: CcfoliaCharacter): boolean {
  if (character.invisible)
    return false
  if (typeof character.x !== 'number' || typeof character.y !== 'number')
    return false
  if (!Number.isFinite(character.x) || !Number.isFinite(character.y))
    return false
  const grid = useSettingsStore().grid
  const piece = {
    x: character.x,
    y: character.y,
    widthCells: typeof character.width === 'number' && Number.isFinite(character.width) ? character.width : 1,
    heightCells: typeof character.height === 'number' && Number.isFinite(character.height) ? character.height : 1,
  }
  const bc = pieceBottomCenter(piece, grid)
  return pxToCell({ x: bc.x, y: bc.y - CELL_BOUNDARY_EPS }, grid) !== null
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

// 角色脚下从主板内移到主板外时,触发回满 HP / MP(条件:任一 tag 开启 autoRestoreOnMoveOutside)。
// 反向(场外移回场内)不做任何事 —— 「移出场外」是单向触发。冷启动只填 cache,避免一进房间就把
// 现成场外角色全部回满一遍。
function reconcileTagMoveOffBoardRestore(list: CcfoliaCharacter[]) {
  for (const character of list) {
    const next = classifyOnCanvas(character)
    const prev = onCanvasCache.get(character._id)
    onCanvasCache.set(character._id, next)
    if (prev === undefined || prev === next)
      continue
    if (prev !== true || next !== false)
      continue
    if (!shouldAutoRestoreOnMoveOutside(character))
      continue
    restoreHpMpToMax(character).catch((error) => {
      console.error('[ccs] restore hp/mp on move-off-board failed', error)
    })
  }
}

function trySubscribe(): boolean {
  if (unsub)
    return true
  const store = getReduxStore()
  if (!store)
    return false
  const pinia = useRoomCharactersStore()
  pinia.replace(materialize(selectRoomCharacters(store.getState())))
  reconcileAliveDiff(pinia.list)
  reconcileTagKnockdownHpZeroDiff(pinia.list)
  reconcileTagMoveOffBoardRestore(pinia.list)
  reconcileHpFxDiff(pinia.list)
  unsub = subscribeSlice(
    store,
    selectRoomCharacters,
    (slice) => {
      pinia.replace(materialize(slice))
      reconcileAliveDiff(pinia.list)
      reconcileTagKnockdownHpZeroDiff(pinia.list)
      reconcileTagMoveOffBoardRestore(pinia.list)
      reconcileHpFxDiff(pinia.list)
    },
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
  unsub?.()
  unsub = null
  aliveCache = new Map()
  hpZeroCache = new Map()
  onCanvasCache = new Map()
  hpFxCache = new Map()
}
