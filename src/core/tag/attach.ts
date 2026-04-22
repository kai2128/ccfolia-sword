import type { CcfoliaParam } from '@/types/ccfolia'
import type { TagInstancePayload } from '@/types/tag'
import { tagLabel } from '@/types/tag'

// 不可变更新 params。attach 幂等:同一 tag 再挂会覆盖 attachedAt。
export function buildAttachTagParams(
  params: CcfoliaParam[],
  definitionId: string,
  attachedAt: number,
): CcfoliaParam[] {
  const label = tagLabel(definitionId)
  const payload: TagInstancePayload = { attachedAt }
  const next = params.filter(param => param.label !== label)
  next.push({ label, value: JSON.stringify(payload) })
  return next
}

export function buildDetachTagParams(
  params: CcfoliaParam[],
  definitionId: string,
): CcfoliaParam[] {
  const label = tagLabel(definitionId)
  return params.filter(param => param.label !== label)
}
