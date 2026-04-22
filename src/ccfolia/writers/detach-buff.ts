import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { applyBuffOps, removeBuff } from '@/core/buff/params-rmw'

export async function detachBuff(characterId: string, buffId: string): Promise<void> {
  await serializedParamsUpdate(characterId, current => applyBuffOps(current, [removeBuff(buffId)]))
}
