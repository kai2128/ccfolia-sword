import type { CcfoliaParam } from '@/types/ccfolia'
import type { ParkedPayload } from '@/types/parked-location'
import { PARKED_LABEL } from '@/types/parked-location'

// 不可变更新 params。save 幂等:同一角色再保存覆盖旧 x/y/savedAt。
export function buildSaveParkedParams(
  params: CcfoliaParam[],
  x: number,
  y: number,
  savedAt: number,
): CcfoliaParam[] {
  const payload: ParkedPayload = { x, y, savedAt }
  const next = params.filter(param => param.label !== PARKED_LABEL)
  next.push({ label: PARKED_LABEL, value: JSON.stringify(payload) })
  return next
}

export function buildClearParkedParams(params: CcfoliaParam[]): CcfoliaParam[] {
  return params.filter(param => param.label !== PARKED_LABEL)
}
