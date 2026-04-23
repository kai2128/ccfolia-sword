import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { decodeBuff, isBuffLabel } from '@/core/buff/codec'
import { applyBuffOps, updateBuff } from '@/core/buff/params-rmw'

// 死亡转 down 时:把所有仍启用的 buff 禁用并打 disabledByDeath 标记,已被 GM 手动禁用的不动。
// 复活转 alive 时:只启用带 disabledByDeath 标记的 buff,清掉标记。GM 在死亡期间手动改过的 buff 不会被覆盖。
export function applyDeathRevivalToBuffs(
  params: CcfoliaParam[],
  enabled: boolean,
): CcfoliaParam[] {
  const ops = params.flatMap((param) => {
    if (!isBuffLabel(param.label))
      return []

    const buff = decodeBuff(param.value)
    if (!buff)
      return []

    if (!enabled) {
      // 变 down:仅 disable 当前 enabled 的;打上标记以便复活恢复
      if (!buff.enabled)
        return []
      const next: BuffInstance = { ...buff, enabled: false, disabledByDeath: true }
      return [updateBuff(next)]
    }
    // 变 alive:仅恢复带 disabledByDeath 标记的(= 是我们之前 disable 的);
    // GM 手动启用过的没标记,跳过;GM 手动禁用过的也没标记,尊重意图
    if (!buff.disabledByDeath)
      return []
    const { disabledByDeath: _, ...rest } = buff
    const next: BuffInstance = { ...rest, enabled: true }
    return [updateBuff(next)]
  })

  if (ops.length === 0)
    return params

  return applyBuffOps(params, ops)
}

export async function batchSetBuffsEnabledForCharacter(
  characterId: string,
  enabled: boolean,
): Promise<void> {
  await serializedParamsUpdate(characterId, current => applyDeathRevivalToBuffs(current, enabled))
}
