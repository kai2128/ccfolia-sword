import type { CcfoliaStatus } from '@/types/ccfolia'
import type { StatusLabelMap, StatusSlot } from './default-label-map'

export interface StatusSlotRead {
  value: number
  max: number
}

export function readStatusSlot(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  labelMap: StatusLabelMap,
): StatusSlotRead | null {
  const label = labelMap[slot]
  const entry = status.find(s => s.label === label)
  if (!entry)
    return null
  return { value: entry.value, max: entry.max }
}

export function readStatusValue(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  labelMap: StatusLabelMap,
): number | null {
  return readStatusSlot(status, slot, labelMap)?.value ?? null
}

export function readStatusMax(
  status: CcfoliaStatus[],
  slot: StatusSlot,
  labelMap: StatusLabelMap,
): number | null {
  return readStatusSlot(status, slot, labelMap)?.max ?? null
}
