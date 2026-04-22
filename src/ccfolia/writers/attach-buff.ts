import type { BuffInstance } from '@/types/buff-v3'
import { withParamsLock } from '@/ccfolia/firestore-writer'
import { appendBuff, applyBuffOps } from '@/core/buff/params-rmw'

export async function attachBuff(characterId: string, buff: BuffInstance): Promise<void> {
  await withParamsLock(characterId, current => applyBuffOps(current, [appendBuff(buff)]))
}
