import type { StatusLabelMap, StatusSlot } from './default-label-map'
import type { CcfoliaStatus } from '@/types/ccfolia'

export interface StatusSlotRead {
  value: number
  max: number
}

// partPrefix:多部位场景下传 'XX' / 'X1' 等;非多部位调用方不传,行为不变。
export function readStatusSlot(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  labelMap: StatusLabelMap,
  partPrefix: string = '',
): StatusSlotRead | null {
  const label = partPrefix + labelMap[slot]
  const entry = status.find(s => s.label === label)
  if (!entry)
    return null
  return { value: entry.value, max: entry.max }
}

export function readStatusValue(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  labelMap: StatusLabelMap,
  partPrefix: string = '',
): number | null {
  return readStatusSlot(status, slot, labelMap, partPrefix)?.value ?? null
}

export function readStatusMax(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  labelMap: StatusLabelMap,
  partPrefix: string = '',
): number | null {
  return readStatusSlot(status, slot, labelMap, partPrefix)?.max ?? null
}
