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
