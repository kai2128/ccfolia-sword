import type { BuffInstance } from '@/types/buff-v3'
import { withParamsLock } from '@/ccfolia/firestore-writer'
import { decodeBuff } from '@/core/buff/codec'
import { applyBuffOps, updateBuff } from '@/core/buff/params-rmw'

export async function setBuffEnabled(
  characterId: string,
  buffId: string,
  enabled: boolean,
): Promise<void> {
  await withParamsLock(characterId, (current) => {
    const entry = current.find(param => param.label === `cs_buff_${buffId}`)
    if (!entry)
      return current

    const buff = decodeBuff(entry.value)
    if (!buff || buff.enabled === enabled)
      return current

    const next: BuffInstance = { ...buff, enabled }
    return applyBuffOps(current, [updateBuff(next)])
  })
}
