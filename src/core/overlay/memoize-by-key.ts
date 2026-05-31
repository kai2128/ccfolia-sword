// 按 key 做 per-item 记忆化的小工具。
// 用于 overlay/roster 这类「列表整体换引用、但多数 item 没变」的场景:
// 只对签名变化的 item 调 build,其余复用上次输出对象(连同引用,下游 props 不变 → 不重渲染)。
//
// cache 由调用方持有(模块级/闭包级),跨调用保留。
// signature: 返回一组「浅比较即可判定是否变化」的值(通常含对象引用,如 char 引用)。
//   - RTK/Immer 保证未变 entity 跨帧同引用,所以一个 char 引用基本覆盖其全部字段。
//   - 跨 item 的外部依赖(如 AoE 覆盖结果、crowd/mode)也塞进 signature。

export interface MemoEntry<V> {
  sig: unknown[]
  value: V
}

function sameSig(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i]))
      return false
  }
  return true
}

export function memoizeByKey<T, V>(
  cache: Map<string, MemoEntry<V>>,
  items: T[],
  keyOf: (item: T) => string,
  sigOf: (item: T) => unknown[],
  build: (item: T) => V,
): V[] {
  const seen = new Set<string>()
  const out: V[] = []

  for (const item of items) {
    const key = keyOf(item)
    seen.add(key)
    const sig = sigOf(item)
    const cached = cache.get(key)
    if (cached && sameSig(cached.sig, sig)) {
      out.push(cached.value)
      continue
    }
    const value = build(item)
    cache.set(key, { sig, value })
    out.push(value)
  }

  // 清理已移除的 key,避免缓存无限增长
  if (cache.size > seen.size) {
    for (const key of cache.keys()) {
      if (!seen.has(key))
        cache.delete(key)
    }
  }

  return out
}
