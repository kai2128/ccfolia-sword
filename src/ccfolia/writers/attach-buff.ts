import type { BuffInstance } from '@/types/buff-v3'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { appendBuff, applyBuffOps } from '@/core/buff/params-rmw'

export async function attachBuff(characterId: string, buff: BuffInstance): Promise<void> {
  await serializedParamsUpdate(characterId, current => applyBuffOps(current, [appendBuff(buff)]))
}
