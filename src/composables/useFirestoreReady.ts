import { onBeforeUnmount, ref } from 'vue'
import { getFirestoreApi, onFirestoreApiReady } from '@/ccfolia/webpack-hook'

// ccfolia 的 Firebase SDK 被挖出来就算 ready — 写操作能走 SDK。
// webpack-hook 有 retry 退避,最慢也就十几秒,UI gate 在这里。
export function useFirestoreReady() {
  const ready = ref(getFirestoreApi() !== null)
  const stop = onFirestoreApiReady(() => { ready.value = true })
  onBeforeUnmount(stop)
  return { ready }
}
