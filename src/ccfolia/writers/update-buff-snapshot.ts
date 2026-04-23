import type { NormalizedBuffForm } from '@/core/buff/form-helpers'
import type { AttachTarget, BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { buffLabel, decodeBuff, encodeBuff } from '@/core/buff/codec'
import { deriveLifecycle } from '@/core/buff/form-helpers'

// 根据 patch.scope 调整 attachedTo:
// - single ↔ aoe 切换时,center/characterId 沿用旧挂载的主体 id(对 single 是 characterId,对 aoe 是 centerCharacterId)
// - aoe 保持时只刷新 radius,保留 includeOverride / excludeOverride
function nextAttached(old: AttachTarget, patch: NormalizedBuffForm): AttachTarget {
  const anchorId = old.kind === 'aoe' ? old.centerCharacterId : old.characterId
  if (patch.scope === 'aoe' && patch.aoeRadius !== undefined) {
    if (old.kind === 'aoe')
      return { ...old, radius: patch.aoeRadius }
    return { kind: 'aoe', centerCharacterId: anchorId, radius: patch.aoeRadius }
  }
  if (old.kind === 'single')
    return old
  return { kind: 'single', characterId: anchorId }
}

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

  const updated: BuffInstance = {
    ...oldBuff,
    snapshot: {
      ...oldBuff.snapshot,
      name: patch.name,
      description: patch.description,
      icon: patch.icon,
      polarity: patch.polarity,
      actionValue: patch.actionValue,
    },
    attachedTo: nextAttached(oldBuff.attachedTo, patch),
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
