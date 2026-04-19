import { onBeforeUnmount, ref } from 'vue'
import { getIdToken } from '@/ccfolia/auth-token'

// 每秒轮询 IDB,确认 Firebase ID token 可读。
// 这是 MVP 的写操作前置条件。更稳的做法是监听 IDB 变化(换 window.open
// → upgradeNeeded 之类),但目前轮询足够便宜。
export function useCcfoliaSession(intervalMs = 1000) {
  const ready = ref(false)

  async function check() {
    const info = await getIdToken()
    if (info && info.expirationTime > Date.now())
      ready.value = true
    else
      ready.value = false
  }

  check()
  const timer = window.setInterval(check, intervalMs)
  onBeforeUnmount(() => window.clearInterval(timer))

  return { ready }
}
