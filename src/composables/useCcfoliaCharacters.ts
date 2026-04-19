import type { CcfoliaCharacter } from '@/types/ccfolia'
import { onBeforeUnmount, ref } from 'vue'
import { getAllCharactersInRoom, scanRoomFallback } from '@/ccfolia/fiber-reader'

// 轮询读取当前房间的所有角色。MVP 阶段先用定时器,
// 稳定后换成 MutationObserver(见 M1 后续任务)。
export function useCcfoliaCharacters(intervalMs = 1000) {
  const characters = ref<CcfoliaCharacter[]>([])
  const usingFallback = ref(false)

  function tick() {
    let list = getAllCharactersInRoom()
    if (list.length === 0) {
      // .movable 选择器 miss,试一次全局扫
      const fallback = scanRoomFallback()
      if (fallback.length > 0) {
        usingFallback.value = true
        list = fallback
      }
    }
    else {
      usingFallback.value = false
    }
    characters.value = list
  }

  tick()
  const timer = window.setInterval(tick, intervalMs)
  onBeforeUnmount(() => window.clearInterval(timer))

  return { characters, usingFallback, refresh: tick }
}
