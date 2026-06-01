import type { AoeIndicator } from './aoe-indicator'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { decodeAoe, isAoeLabel } from './aoe-codec'

// 按 params 数组引用缓存解析结果(同 collectBuffs 思路):ccfolia RTK/Immer 只在内容变化时
// 换新 params 引用,拖棋子(仅改 x/y)时引用不变 → 命中缓存,免去每帧重复 JSON.parse。
const cache = new WeakMap<object, AoeIndicator[]>()

export function collectAoeFromParams(char: CcfoliaCharacter): AoeIndicator[] {
  const params = char.params
  if (!params || params.length === 0)
    return []

  const cached = cache.get(params)
  if (cached)
    return cached

  const out: AoeIndicator[] = []
  for (const param of params) {
    if (!isAoeLabel(param.label))
      continue
    const stored = decodeAoe(param.value)
    if (stored)
      out.push({ ...stored, characterId: char._id })
  }
  cache.set(params, out)
  return out
}
