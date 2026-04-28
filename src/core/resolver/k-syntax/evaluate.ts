import type { ParsedPowerCommand } from './parse'
import type { CritRoll } from '@/core/resolver/types'
import type { PowerTable } from '@/types/power-table'
import { lookupPowerDamage } from '@/core/power-table/lookup'

export interface EvaluationResult {
  baseDamage: number
  total: number
  breakdown: string
}

export function evaluatePowerCommand(
  parsed: ParsedPowerCommand,
  table: PowerTable,
  dice: { main: [number, number], crits: CritRoll[] },
): EvaluationResult {
  const lookup = ([a, b]: [number, number]) => lookupPowerDamage(table, parsed.power, a + b)

  const mainDamage = lookup(dice.main)
  const critDamages = dice.crits.map(lookup)
  const baseDamage = mainDamage + critDamages.reduce((sum, damage) => sum + damage, 0)
  const afterHalf = parsed.half ? Math.ceil(baseDamage / 2) : baseDamage
  const total = afterHalf + parsed.modifier

  const breakdown = [
    `威力${parsed.power}`,
    `主${dice.main[0]}+${dice.main[1]}→${mainDamage}`,
    ...dice.crits.map(([a, b], index) => `暴${index + 1} ${a}+${b}→${critDamages[index]}`),
    parsed.half ? `半减→${afterHalf}` : '',
    parsed.modifier !== 0 ? `${parsed.modifier >= 0 ? '+' : ''}${parsed.modifier}` : '',
  ].filter(Boolean).join(' | ')

  return {
    baseDamage,
    total,
    breakdown,
  }
}
