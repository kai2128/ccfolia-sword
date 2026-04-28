// 这里走 legacy 同步 API,便于 shared state 直接同步读写。
declare function GM_setValue(key: string, value: unknown): void
declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_deleteValue(key: string): void
declare function GM_listValues(): string[]

export function writeSharedValue(key: string, value: unknown): void {
  GM_setValue(key, JSON.stringify(value))
}

export function readSharedValue<T>(key: string, defaultValue: T): T {
  const raw = GM_getValue<string | undefined>(key, undefined)
  if (typeof raw !== 'string' || raw === '')
    return defaultValue

  try {
    return JSON.parse(raw) as T
  }
  catch {
    return defaultValue
  }
}

// 删除所有以 prefix 开头的 GM 值。返回被删的 key 数。
// 用于"重置全部配置和数据":本项目所有 store 都用 `ccs:` 前缀。
export function deleteValuesByPrefix(prefix: string): number {
  const keys = GM_listValues().filter(k => k.startsWith(prefix))
  for (const k of keys)
    GM_deleteValue(k)
  return keys.length
}
