import type { BuffInstance } from '@/types/buff-v3'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { decodeBuff } from '@/core/buff/codec'
import { applyBuffOps, updateBuff } from '@/core/buff/params-rmw'

export async function updateAoeCoverage(
  centerCharacterId: string,
  buffId: string,
  includeOverride: string[],
  excludeOverride: string[],
): Promise<void> {
  await serializedParamsUpdate(centerCharacterId, (current) => {
    const entry = current.find(param => param.label === `cs_buff_${buffId}`)
    if (!entry)
      return current
    const buff = decodeBuff(entry.value)
    if (!buff || buff.attachedTo.kind !== 'aoe')
      return current
    const next: BuffInstance = {
      ...buff,
      attachedTo: {
        ...buff.attachedTo,
        includeOverride: includeOverride.length ? includeOverride : undefined,
        excludeOverride: excludeOverride.length ? excludeOverride : undefined,
      },
    }
    return applyBuffOps(current, [updateBuff(next)])
  })
}
