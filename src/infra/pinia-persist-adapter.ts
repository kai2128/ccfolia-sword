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
