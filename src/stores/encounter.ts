import { defineStore } from 'pinia'
import { tickBuffTurnsForAllCharacters } from '@/ccfolia/writers/tick-buff-turns'
import { readSharedValue, writeSharedValue } from '@/infra/gm-values'
import { createLogger } from '@/infra/log'

const log = createLogger('encounter')

export interface SharedEncounterState {
  inCombat: boolean
  turn: number
}

export interface LocalEncounterState {
  pendingIds: string[]
  actedIds: string[]
  currentActorId: string | null
  // 射程圈:characterId → 半径(格=米)。键存在 = 显示。多角色可同时开启。
  rangeCircles: Record<string, number>
}

interface EncounterStoreState {
  shared: SharedEncounterState
  local: LocalEncounterState
}

const SHARED_KEY = 'ccs:encounter:shared'
const LOCAL_KEY = 'ccs:encounter:local'

function defaultShared(): SharedEncounterState {
  return { inCombat: false, turn: 0 }
}

function defaultLocal(): LocalEncounterState {
  return { pendingIds: [], actedIds: [], currentActorId: null, rangeCircles: {} }
}

function loadShared(): SharedEncounterState {
  const raw = readSharedValue<SharedEncounterState>(SHARED_KEY, defaultShared())
  return { ...defaultShared(), ...raw }
}

function loadLocal(): LocalEncounterState {
  try {
    const raw = sessionStorage.getItem(LOCAL_KEY)
    if (!raw)
      return defaultLocal()
    const parsed = JSON.parse(raw) as Partial<LocalEncounterState>
    return { ...defaultLocal(), ...parsed }
  }
  catch {
    return defaultLocal()
  }
}

export function persistShared(state: SharedEncounterState): void {
  writeSharedValue(SHARED_KEY, state)
}

export function persistLocal(state: LocalEncounterState): void {
  try {
    sessionStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  }
  catch {
    // sessionStorage 可能被禁用或写满,这里忽略即可。
  }
}

export const useEncounterStore = defineStore('encounter', {
  state: (): EncounterStoreState => ({
    shared: loadShared(),
    local: loadLocal(),
  }),
  getters: {
    isParticipant: state => (id: string): boolean =>
      state.local.pendingIds.includes(id) || state.local.actedIds.includes(id),
  },
  actions: {
    beginCombat(participantIds: string[]) {
      this.shared.inCombat = true
      this.shared.turn = 1
      this.local.pendingIds = [...participantIds]
      this.local.actedIds = []
      this.local.currentActorId = null
    },
    endCombat() {
      this.shared.inCombat = false
      this.shared.turn = 0
      this.local.pendingIds = []
      this.local.actedIds = []
      this.local.currentActorId = null
      this.local.rangeCircles = {}
    },
    selectActor(id: string) {
      this.local.currentActorId = id
    },
    finishActor(id: string) {
      const index = this.local.pendingIds.indexOf(id)
      if (index >= 0) {
        this.local.pendingIds.splice(index, 1)
        this.local.actedIds.push(id)
      }
      if (this.local.currentActorId === id)
        this.local.currentActorId = null
    },
    nextTurn() {
      this.shared.turn += 1
      this.local.pendingIds = [...this.local.pendingIds, ...this.local.actedIds]
      this.local.actedIds = []
      this.local.currentActorId = null
      // 推进所有角色身上 buff 的 turnsRemaining;-1 后到 0 自动卸载。fire-and-forget。
      tickBuffTurnsForAllCharacters().catch(error => log.error('tick buff turns failed', { error }))
    },
    addParticipant(id: string) {
      if (!this.isParticipant(id))
        this.local.pendingIds.push(id)
    },
    removeParticipant(id: string) {
      this.local.pendingIds = this.local.pendingIds.filter(item => item !== id)
      this.local.actedIds = this.local.actedIds.filter(item => item !== id)
      if (this.local.currentActorId === id)
        this.local.currentActorId = null
    },
    toggleRangeCircle(characterId: string, defaultRadius = 3) {
      if (characterId in this.local.rangeCircles)
        delete this.local.rangeCircles[characterId]
      else
        this.local.rangeCircles[characterId] = defaultRadius
    },
    setRangeRadius(characterId: string, radius: number) {
      if (characterId in this.local.rangeCircles)
        this.local.rangeCircles[characterId] = radius
    },
    clearRangeCircles() {
      this.local.rangeCircles = {}
    },
  },
})
