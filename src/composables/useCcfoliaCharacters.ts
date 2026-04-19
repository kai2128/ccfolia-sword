import type { CcfoliaCharacter } from '@/types/ccfolia'
import { onBeforeUnmount, ref } from 'vue'
import { getAllCharactersInRoom, scanRoomFallback } from '@/ccfolia/fiber-reader'
import { getReduxStore } from '@/ccfolia/redux-store'

// 订阅 ccfolia 的 Redux store,数据瞬间同步。
// store 还没就位时(刚打开首页,房间没进)用 fiber 轮询兜底。
// 一旦 subscribe 成功,立刻停轮询 — 完全靠 store 推。
//
// roomId 切换(同一个 SPA 内部跳房间)是同一个 store,subscribe 会收到路由
// action 触发 tick — 不用重抓 store,也不用监听 history。
export function useCcfoliaCharacters(bootstrapIntervalMs = 1000) {
  const characters = ref<CcfoliaCharacter[]>([])
  const usingFallback = ref(false)

  // 直接从 store 读 — entities.roomCharacters.{ids, entities, idsGroupBy},
  // 过滤 active === true 拿到桌面上的那一批。
  function readFromStore(): CcfoliaCharacter[] | null {
    const store = getReduxStore()
    if (!store)
      return null
    const state = store.getState() as {
      entities?: { roomCharacters?: { ids: string[], entities: Record<string, CcfoliaCharacter> } }
    }
    const col = state.entities?.roomCharacters
    if (!col)
      return null
    const out: CcfoliaCharacter[] = []
    for (const id of col.ids) {
      const c = col.entities[id]
      if (c && c.active)
        out.push(c)
    }
    return out
  }

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

  function tick() {
    const fromStore = readFromStore()
    if (fromStore !== null) {
      usingFallback.value = false
      characters.value = fromStore
    }
    else {
      characters.value = readFromFiber()
    }
  }

  tick()

  // bootstrap:store 找不到时周期性 retry 订阅;subscribe 成功即停。
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
    unsubscribe = store.subscribe(tick)
    tick()
    stopBootstrap()
    return true
  }

  if (!trySubscribe()) {
    bootstrapTimer = window.setInterval(() => {
      if (!trySubscribe())
        tick() // fiber 兜底期间持续刷新
    }, bootstrapIntervalMs)
  }

  onBeforeUnmount(() => {
    stopBootstrap()
    unsubscribe?.()
  })

  return { characters, usingFallback, refresh: tick }
}
