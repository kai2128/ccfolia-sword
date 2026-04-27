import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { createLogger } from '@/infra/log'
import { decodeBuff, isBuffLabel } from './codec'

const log = createLogger('collect-buffs')

export function collectBuffs(character: CcfoliaCharacter): BuffInstance[] {
  const buffs: BuffInstance[] = []

  for (const param of character.params ?? []) {
    if (!isBuffLabel(param.label))
      continue
    const buff = decodeBuff(param.value)
    if (!buff) {
      log.warn('skip invalid buff param', { characterId: character._id, label: param.label })
      continue
    }
    buffs.push(buff)
  }

  return buffs
}

// 多部位:返回挂在指定 partKey 的 single buff(partKey 缺省视为 '')。
// AoE buff 不参与 —— 它由中心角色的位置决定覆盖,与 part 无关。
export function collectBuffsForPart(character: CcfoliaCharacter, partKey: string): BuffInstance[] {
  return collectBuffs(character).filter(b =>
    b.attachedTo.kind === 'single' && (b.attachedTo.partKey ?? '') === partKey,
  )
}
