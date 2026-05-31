import type { StorageLike } from 'pinia-plugin-persistedstate'

// Pinia persistedstate 的 storage 接口要求同步 getItem。
// Tampermonkey 提供两套 API:
//   · `GM_*`(下划线,legacy):同步,返回值
//   · `GM.*`(点号,新式):异步,返回 Promise
// 这里用 legacy 同步版以满足 pinia 接口;vite.config.ts 里对应 grant 的也是 `GM_*`。
//
// key 约定:上层 store 自己带 `ccs:<子系统>:<名字>` 前缀,避免撞 ccfolia 或其他脚本,
// 因此本适配器不再加前缀。
export const gmStorage: StorageLike = {
  getItem(key: string): string | null {
    const raw = GM_getValue<string | null>(key, null)
    return raw ?? null
  },
  setItem(key: string, value: string): void {
    GM_setValue(key, value)
  },
}

// 去抖版 gmStorage:把一串高频写入(如拖动 slider)合并成尾帧一次 GM_setValue。
// 解决多 tab 场景的回弹竞态 —— 每帧广播会被对端 $patch 回弹,而 GM 跨 tab 投递是
// 异步的,迟到的旧值落地时本地已拖到新值,等值守卫失效 → 滑块被打回、自己上下跳。
// 合并广播后对端只收到尾帧最终值,回弹风暴消失。persist 每次序列化整份 state,
// 合并只丢中间帧、不丢字段,所以安全。pagehide 时 flush,避免关页丢掉最后一次写入。
export function createDebouncedGmStorage(delayMs: number): StorageLike {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { key: string, value: string } | null = null

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (pending) {
      GM_setValue(pending.key, pending.value)
      pending = null
    }
  }

  if (typeof window !== 'undefined')
    window.addEventListener('pagehide', flush)

  return {
    getItem(key: string): string | null {
      // 有挂起写入时返回挂起值,避免读到过期的 GM 值。
      if (pending && pending.key === key)
        return pending.value
      return GM_getValue<string | null>(key, null) ?? null
    },
    setItem(key: string, value: string): void {
      pending = { key, value }
      if (timer !== null)
        clearTimeout(timer)
      timer = setTimeout(flush, delayMs)
    },
  }
}
