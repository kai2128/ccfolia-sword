import type { CcfoliaCharacter } from '@/types/ccfolia'
import { onBeforeUnmount, ref } from 'vue'
import { getAllCharactersInRoom, scanRoomFallback } from '@/ccfolia/fiber-reader'
import { getReduxStore } from '@/ccfolia/redux-store'

// 订阅 ccfolia 的 Redux store,数据瞬间同步。
// store 找不到之前(刚打开房间,React 还没挂好)用 fiber 轮询兜底。
// 一旦 store 拿到就切到订阅路径,fiber 不再用。
export function useCcfoliaCharacters(intervalMs = 1000) {
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
    let list = getAllCharactersInRoom()
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

  // store 找到就订阅;没找到就继续 poll,直到 subscribe 成功
  let unsubscribe: (() => void) | null = null
  function trySubscribe() {
    if (unsubscribe)
      return
    const store = getReduxStore()
    if (!store)
      return
    unsubscribe = store.subscribe(tick)
    tick()
  }
  trySubscribe()

  // poll 仍然保留:一是 store 没找到时兜底读 fiber,二是拿到 store 后把订阅挂上
  const timer = window.setInterval(() => {
    trySubscribe()
    // 订阅起作用后,这里的 tick 是冗余的但无害
    if (!unsubscribe)
      tick()
  }, intervalMs)
  onBeforeUnmount(() => {
    window.clearInterval(timer)
    unsubscribe?.()
  })

  return { characters, usingFallback, refresh: tick }
}
