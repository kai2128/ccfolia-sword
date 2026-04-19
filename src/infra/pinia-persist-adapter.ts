import type { StorageLike } from 'pinia-plugin-persistedstate'

// Pinia persistedstate 的 storage 接口要求同步 getItem。
// GM.getValue 在 Tampermonkey 里是同步的(返回值而非 Promise),
// 直接用即可;为严谨起见这里做类型适配。
export const gmStorage: StorageLike = {
  getItem(key: string): string | null {
    const raw = GM_getValue<string | null>(key, null)
    return raw ?? null
  },
  setItem(key: string, value: string): void {
    GM_setValue(key, value)
  },
}
