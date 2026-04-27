import type { StatusLabelMap } from '@/core/status-slot'
import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaCharacter, CcfoliaStatus } from '@/types/ccfolia'
import type { Modifier, ModifierTarget } from '@/types/modifier'
import { collectBuffsForPart } from '@/core/buff/collect'
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

export function sumModifiersFromBuffs(
  buffs: BuffInstance[],
  target: ModifierTarget,
): ModifierContribution[] {
  const out: ModifierContribution[] = []

  for (const buff of buffs) {
    if (!buff.enabled)
      continue
    for (const modifier of buff.snapshot.modifiers) {
      if (modifier.target === target)
        out.push({ target: modifier.target, value: modifier.value })
    }
  }

  return out
}

// 多部位:char 级 buff(partKey='')对所有 part 生效;part 级 buff(partKey='X1')只对该 part 生效。
// 单部位传 partKey=''(默认),退化为只读 char 级 buff —— 即原始行为。
export function collectDefenseMods(character: CcfoliaCharacter, partKey: string = ''): ModifierContribution[] {
  const buffs = partKey === ''
    ? collectBuffsForPart(character, '')
    : [...collectBuffsForPart(character, ''), ...collectBuffsForPart(character, partKey)]
  return sumModifiersFromBuffs(buffs, 'defense')
}
