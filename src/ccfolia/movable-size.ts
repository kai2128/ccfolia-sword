import { getCharacterFromElement } from './fiber-reader'

// querySelectorAll('.movable') + 沿 React Fiber 找 character 是非平凡开销(fiber-reader 单次最多走 80 层)。
// SceneOverlayLayer / RangeCircle / FxLayer 同帧都需要这份索引,共用一份 microtask 缓存,扫一次。
let cache: Map<string, { width: number, height: number }> | null = null

export function getMovableSizes(): Map<string, { width: number, height: number }> {
  if (cache)
    return cache
  const map = new Map<string, { width: number, height: number }>()
  for (const el of document.querySelectorAll<HTMLElement>('.movable')) {
    const c = getCharacterFromElement(el)
    if (c?._id && el.offsetWidth > 0)
      map.set(c._id, { width: el.offsetWidth, height: el.offsetHeight })
  }
  cache = map
  queueMicrotask(() => {
    cache = null
  })
  return map
}
