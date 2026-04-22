import type { NormalizedBuffForm } from '@/core/buff/form-helpers'
import type { CcfoliaParam } from '@/types/ccfolia'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { buffLabel, decodeBuff, encodeBuff } from '@/core/buff/codec'
import { deriveLifecycle } from '@/core/buff/form-helpers'

// 纯函数:供单测和 writer 入口共用。返回值若引用相同视为无变化(serializedParamsUpdate 跳过空写)。
export function applyBuffSnapshotPatch(
  params: CcfoliaParam[],
  buffId: string,
  patch: NormalizedBuffForm,
): CcfoliaParam[] {
  const label = buffLabel(buffId)
  const index = params.findIndex(p => p.label === label)
  if (index < 0)
    return params

  const oldBuff = decodeBuff(params[index].value)
  if (!oldBuff)
    return params

  const updated = {
    ...oldBuff,
    snapshot: {
      ...oldBuff.snapshot,
      name: patch.name,
      description: patch.description,
      icon: patch.icon,
      polarity: patch.polarity,
    },
    turnsRemaining: patch.turnsRemaining,
    lifecycle: deriveLifecycle(patch.turnsRemaining),
  }

  const next = params.slice()
  next[index] = { label, value: encodeBuff(updated) }
  return next
}

export async function updateBuffSnapshot(
  characterId: string,
  buffId: string,
  patch: NormalizedBuffForm,
): Promise<void> {
  await serializedParamsUpdate(characterId, current => applyBuffSnapshotPatch(current, buffId, patch))
}
