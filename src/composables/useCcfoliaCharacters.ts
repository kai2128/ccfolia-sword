import type { CcfoliaCharacter } from '@/types/ccfolia'
import { onBeforeUnmount, ref } from 'vue'
import { getAllCharactersInRoom, scanRoomFallback } from '@/ccfolia/fiber-reader'
import { getReduxStore, subscribeSlice } from '@/ccfolia/redux-store'

// 订阅 ccfolia 的 Redux store,数据瞬间同步。
// store 还没就位时(刚打开首页,房间没进)用 fiber 轮询兜底。
// 一旦 subscribe 成功,立刻停轮询 — 完全靠 store 推。
//
// roomId 切换(同一个 SPA 内部跳房间)是同一个 store,subscribe 会收到路由
// action 触发 tick — 不用重抓 store,也不用监听 history。
//
// 性能:用 subscribeSlice 只监听 `state.entities.roomCharacters`,其他 action
// (鼠标移动、骰子、chat)不触发 tick。RTK Immer 保证该引用只在真正变动时换。
type RoomCharacters = {
  ids: string[]
  entities: Record<string, CcfoliaCharacter>
} | undefined

function selectRoomCharacters(state: unknown): RoomCharacters {
  return (state as { entities?: { roomCharacters?: RoomCharacters } }).entities?.roomCharacters
}

function materialize(col: RoomCharacters): CcfoliaCharacter[] {
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

export function useCcfoliaCharacters(bootstrapIntervalMs = 1000) {
  const characters = ref<CcfoliaCharacter[]>([])
  const usingFallback = ref(false)

  // 兜底:store 没拿到时用老路径扫 DOM + fiber
  function readFromFiber(): CcfoliaCharacter[] {
    const list = getAllCharactersInRoom()
    if (list.length === 0) {
      const fb = scanRoomFallback()
      if (fb.length > 0) {
        usingFallback.value = true
        return fb
      }
    }
    else {
      usingFallback.value = false
    }
    return list
  }

  function applyFromStore(col: RoomCharacters) {
    usingFallback.value = false
    characters.value = materialize(col)
  }

  function fiberTick() {
    characters.value = readFromFiber()
  }

  fiberTick()

  // bootstrap:store 找不到时周期性 retry;subscribe 成功即停轮询。
  let unsubscribe: (() => void) | null = null
  let bootstrapTimer: number | null = null

  function stopBootstrap() {
    if (bootstrapTimer !== null) {
      window.clearInterval(bootstrapTimer)
      bootstrapTimer = null
    }
  }

  function trySubscribe(): boolean {
    if (unsubscribe)
      return true
    const store = getReduxStore()
    if (!store)
      return false
    unsubscribe = subscribeSlice(store, selectRoomCharacters, applyFromStore, { emitInitial: true })
    stopBootstrap()
    return true
  }

  if (!trySubscribe()) {
    bootstrapTimer = window.setInterval(() => {
      if (!trySubscribe())
        fiberTick() // fiber 兜底期间持续刷新
    }, bootstrapIntervalMs)
  }

  onBeforeUnmount(() => {
    stopBootstrap()
    unsubscribe?.()
  })

  // refresh:store 模式下强制读一遍;fiber 模式下重扫
  function refresh() {
    const store = getReduxStore()
    if (store)
      applyFromStore(selectRoomCharacters(store.getState()))
    else
      fiberTick()
  }

  return { characters, usingFallback, refresh }
}
