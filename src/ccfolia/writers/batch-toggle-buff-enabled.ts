import type { BuffInstance } from '@/types/buff-v3'
import { withParamsLock } from '@/ccfolia/firestore-writer'
import { decodeBuff, isBuffLabel } from '@/core/buff/codec'
import { applyBuffOps, updateBuff } from '@/core/buff/params-rmw'

export async function batchSetBuffsEnabledForCharacter(
  characterId: string,
  enabled: boolean,
): Promise<void> {
  await withParamsLock(characterId, (current) => {
    const ops = current.flatMap((param) => {
      if (!isBuffLabel(param.label))
        return []

      const buff = decodeBuff(param.value)
      if (!buff || buff.enabled === enabled)
        return []

      const next: BuffInstance = { ...buff, enabled }
      return [updateBuff(next)]
    })

    if (ops.length === 0)
      return current

    return applyBuffOps(current, ops)
  })
}
