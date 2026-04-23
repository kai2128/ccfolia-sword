import type { BuffInstance } from '@/types/buff-v3'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { decodeBuff } from '@/core/buff/codec'
import { applyBuffOps, updateBuff } from '@/core/buff/params-rmw'

export async function setBuffEnabled(
  characterId: string,
  buffId: string,
  enabled: boolean,
): Promise<void> {
  await serializedParamsUpdate(characterId, (current) => {
    const entry = current.find(param => param.label === `cs_buff_${buffId}`)
    if (!entry)
      return current

    const buff = decodeBuff(entry.value)
    if (!buff)
      return current
    // GM 手动 toggle 清掉 disabledByDeath 标记 — GM 意图优先于死亡自动恢复
    const needsEnabledChange = buff.enabled !== enabled
    const needsFlagClear = buff.disabledByDeath === true
    if (!needsEnabledChange && !needsFlagClear)
      return current

    const { disabledByDeath: _, ...rest } = buff
    const next: BuffInstance = { ...rest, enabled }
    return applyBuffOps(current, [updateBuff(next)])
  })
}
