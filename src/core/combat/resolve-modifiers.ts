import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaStatus } from '@/types/ccfolia'
import type { Modifier, ModifierTarget } from '@/types/modifier'
import { readStatusValue } from '@/core/status-slot'

// resolve 阶段只关心 target 和 value; 其余字段由上游托管。
export type ModifierContribution = Pick<Modifier, 'target' | 'value'>

export function sumModifiers(mods: ModifierContribution[], target: ModifierTarget): number {
  return mods
    .filter(mod => mod.target === target)
    .reduce((sum, mod) => sum + mod.value, 0)
}

export function resolveDefense(
  status: CcfoliaStatus[],
  labelMap: StatusLabelMap,
  mods: ModifierContribution[],
): number {
  const base = readStatusValue(status, 'defense', labelMap) ?? 0
  return base + sumModifiers(mods, 'defense')
}
