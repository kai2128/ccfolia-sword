import type { CcfoliaCharacter } from '@/types/ccfolia'
import { defineStore } from 'pinia'
import { readStatusValue } from '@/core/status-slot/read'
import { useSettingsStore } from '@/stores/settings'
import { getReduxStore, subscribeSlice } from './redux-store'
import { batchSetBuffsEnabledForCharacter } from './writers/batch-toggle-buff-enabled'

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

function trySubscribe(): boolean {
  if (unsub)
    return true
  const store = getReduxStore()
  if (!store)
    return false
  const pinia = useRoomCharactersStore()
  pinia.replace(materialize(selectRoomCharacters(store.getState())))
  reconcileAliveDiff(pinia.list)
  unsub = subscribeSlice(
    store,
    selectRoomCharacters,
    (slice) => {
      pinia.replace(materialize(slice))
      reconcileAliveDiff(pinia.list)
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
}
