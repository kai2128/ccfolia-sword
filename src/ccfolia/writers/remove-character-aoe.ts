import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { applyAoeOps, removeAoe } from '@/core/range'

export async function removeCharacterAoe(characterId: string, id: string): Promise<void> {
  await serializedParamsUpdate(characterId, current => applyAoeOps(current, [removeAoe(id)]))
}
