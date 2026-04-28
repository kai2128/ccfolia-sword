// 跨 tab 同步小帮手 —— 把 GM_addValueChangeListener 的 boilerplate 收成一处。
// 调用方只关心:这个 GM key 的 remote 变更来了,要怎么 patch 自己的 store。
//
// 同 key 的 listener 模块级幂等:HMR / 多次 hydrate 不会叠加注册。
// 注:已经迁移过的 store 走这个;encounter / overlay-visibility 仍是历史复制粘贴,
// 等下次顺手时再切。

const bound = new Set<string>()

declare function GM_addValueChangeListener(
  key: string,
  listener: (k: string, oldValue: unknown, newValue: unknown, remote: boolean) => void,
): number

export function bindGmCrossTabSync<T = unknown>(
  key: string,
  apply: (parsed: T) => void,
  tag: string,
): void {
  if (bound.has(key))
    return
  if (typeof GM_addValueChangeListener !== 'function') {
    console.warn(`[ccs] ${tag}: GM_addValueChangeListener 不可用,跨 tab 同步关闭`)
    return
  }
  bound.add(key)
  GM_addValueChangeListener(key, (_k, _old, newValue, remote) => {
    // 严格 === true:某些 manager 可能传 undefined/null/0,按"非远程"处理避开自触发环。
    if (remote !== true)
      return
    try {
      const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
      if (parsed === null || parsed === undefined)
        return
      apply(parsed as T)
    }
    catch (e) {
      console.warn(`[ccs] ${tag}: apply remote change failed`, e)
    }
  })
}
