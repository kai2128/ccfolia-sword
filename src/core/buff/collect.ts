import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { createLogger } from '@/infra/log'
import { decodeBuff, isBuffLabel } from './codec'

const log = createLogger('collect-buffs')

// 按 params 数组引用缓存解析结果。ccfolia 的 RTK Immer 只在内容变化时换新数组引用,
// 拖动棋子(仅改 x/y)时 params 引用不变 → 命中缓存,免去每帧对每个角色重复 JSON.parse。
// 返回的数组按约定只读(所有调用方都是 filter / for-of,不原地改),所以可安全共享。
const buffsCache = new WeakMap<object, BuffInstance[]>()

export function collectBuffs(character: CcfoliaCharacter): BuffInstance[] {
  const params = character.params
  if (!params || params.length === 0)
    return []

  const cached = buffsCache.get(params)
  if (cached)
    return cached

  const buffs: BuffInstance[] = []
  for (const param of params) {
    if (!isBuffLabel(param.label))
      continue
    const buff = decodeBuff(param.value)
    if (!buff) {
      log.warn('skip invalid buff param', { characterId: character._id, label: param.label })
      continue
    }
    buffs.push(buff)
  }

  buffsCache.set(params, buffs)
  return buffs
}

// 多部位:返回挂在指定 partKey 的 single buff(partKey 缺省视为 '')。
// AoE buff 不参与 —— 它由中心角色的位置决定覆盖,与 part 无关。
export function collectBuffsForPart(character: CcfoliaCharacter, partKey: string): BuffInstance[] {
  return collectBuffs(character).filter(b =>
    b.attachedTo.kind === 'single' && (b.attachedTo.partKey ?? '') === partKey,
  )
}
