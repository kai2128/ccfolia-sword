import type { TickPrompt } from '@/ccfolia/writers/tick-buff-turns'
import { defineStore } from 'pinia'
import { tickBuffTurnsForAllCharacters } from '@/ccfolia/writers/tick-buff-turns'
import { readSharedValue, writeSharedValue } from '@/infra/gm-values'
import { createLogger } from '@/infra/log'

const log = createLogger('encounter')

export interface SharedEncounterState {
  inCombat: boolean
  turn: number
  // 射程圈:characterId → 半径(格=米)。键存在 = 显示。多角色可同时开启。
  // 放在 shared(GM_setValue 跨 tab)—— GM 在战斗 tab 打开的射程圈,场景 tab 也看得到,
  // 和 HP indicator 一样无缝。不写 ccfolia(本地 userscript 语义)。
  rangeCircles: Record<string, number>
}

export interface LocalEncounterState {
  pendingIds: string[]
  actedIds: string[]
  currentActorId: string | null
}

interface EncounterStoreState {
  shared: SharedEncounterState
  local: LocalEncounterState
}

const SHARED_KEY = 'ccs:encounter:shared'
const LOCAL_KEY = 'ccs:encounter:local'

function defaultShared(): SharedEncounterState {
  return { inCombat: false, turn: 0, rangeCircles: {} }
}

function defaultLocal(): LocalEncounterState {
  return { pendingIds: [], actedIds: [], currentActorId: null }
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

// 跨 tab 同步:另一 tab 改 shared(开战、推回合、切换射程圈)时,本 tab 立即替换 state.shared。
// remote=false 表示是本 tab 自己写的,跳过以免死循环。
export function bindSharedCrossTabSync(store: ReturnType<typeof useEncounterStore>): void {
  if (typeof GM_addValueChangeListener !== 'function') {
    console.warn('[ccs] encounter: GM_addValueChangeListener 不可用,shared 跨 tab 同步关闭')
    return
  }
  GM_addValueChangeListener(SHARED_KEY, (_k, _old, newValue, remote) => {
    if (!remote)
      return
    try {
      const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
      if (!parsed || typeof parsed !== 'object')
        return
      store.$patch((state) => {
        state.shared = { ...defaultShared(), ...(parsed as Partial<SharedEncounterState>) }
      })
    }
    catch (e) {
      console.warn('[ccs] encounter: apply remote shared change failed', e)
    }
  })
}

declare function GM_addValueChangeListener(
  key: string,
  listener: (k: string, oldValue: unknown, newValue: unknown, remote: boolean) => void,
): number

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
      this.shared.rangeCircles = {}
      this.local.pendingIds = []
      this.local.actedIds = []
      this.local.currentActorId = null
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
    // 手动修正回合数(GM 数错了 / 跳着记)。不触发 buff tick、不重置行动池——那是 nextTurn 的事。
    setTurn(n: number) {
      this.shared.turn = Math.max(0, Math.floor(n))
    },
    async nextTurn(): Promise<TickPrompt[]> {
      this.shared.turn += 1
      this.local.pendingIds = [...this.local.pendingIds, ...this.local.actedIds]
      this.local.actedIds = []
      this.local.currentActorId = null
      // 推进所有角色身上 buff 的 turnsRemaining;-1 后到 0 自动卸载。同时收集本回合需提示的 prompts。
      try {
        return await tickBuffTurnsForAllCharacters()
      }
      catch (error) {
        log.error('tick buff turns failed', { error })
        return []
      }
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
      if (characterId in this.shared.rangeCircles) {
        const next = { ...this.shared.rangeCircles }
        delete next[characterId]
        this.shared.rangeCircles = next
      }
      else {
        this.shared.rangeCircles = { ...this.shared.rangeCircles, [characterId]: defaultRadius }
      }
    },
    setRangeRadius(characterId: string, radius: number) {
      if (characterId in this.shared.rangeCircles)
        this.shared.rangeCircles = { ...this.shared.rangeCircles, [characterId]: radius }
    },
    clearRangeCircles() {
      this.shared.rangeCircles = {}
    },
  },
})
