import type { CcfoliaCharacter } from '@/types/ccfolia'
import { buildAttachTagParams, buildDetachTagParams } from '@/core/tag'
import { serializedParamsUpdate } from '../params-queue'

export async function attachTag(char: CcfoliaCharacter, definitionId: string): Promise<void> {
  await serializedParamsUpdate(char._id, params =>
    buildAttachTagParams(params, definitionId, Date.now()))
}

export async function detachTag(char: CcfoliaCharacter, definitionId: string): Promise<void> {
  await serializedParamsUpdate(char._id, (params) => {
    const next = buildDetachTagParams(params, definitionId)
    return next.length === params.length ? params : next
  })
}
