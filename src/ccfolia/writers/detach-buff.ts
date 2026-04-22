import { withParamsLock } from '@/ccfolia/firestore-writer'
import { applyBuffOps, removeBuff } from '@/core/buff/params-rmw'

export async function detachBuff(characterId: string, buffId: string): Promise<void> {
  await withParamsLock(characterId, current => applyBuffOps(current, [removeBuff(buffId)]))
}
