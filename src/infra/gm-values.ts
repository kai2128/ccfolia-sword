// 这里走 legacy 同步 API,便于 shared state 直接同步读写。
declare function GM_setValue(key: string, value: unknown): void
declare function GM_getValue<T>(key: string, defaultValue?: T): T

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
