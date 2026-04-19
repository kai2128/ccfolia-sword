// 威力表原始查表 —— 不解析 k 语法(那是 Phase 5 M5 的事)
//
// 规则(SW2.5):
//   1. 找到 table.entries 里 power === input 的行(若 power 超出最高行,取最后一行;
//      若 power 低于最低行,取第一行 —— 实际威力表通常覆盖完整范围,这里给个稳妥兜底)
//   2. rolls[] 索引 0..10 对应 2d6 掷出 2..12
//   3. 暴击/半减/克里等语义由 k 语法层处理,本函数只返回基础伤害

import type { PowerTable } from '@/types/power-table'

export function lookupPowerDamage(
  table: PowerTable,
  power: number,
  dice2d6Total: number,
): number {
  if (!table.entries.length)
    throw new Error(`power table ${table.id} has no entries`)
  if (dice2d6Total < 2 || dice2d6Total > 12)
    throw new Error(`dice total out of range: ${dice2d6Total}`)

  const row = findRow(table, power)
  return row.rolls[dice2d6Total - 2]
}

function findRow(table: PowerTable, power: number) {
  // 按 power 升序假设;线性扫描(表最多 ~100 行,无需二分)
  let chosen = table.entries[0]
  for (const row of table.entries) {
    if (row.power <= power)
      chosen = row
    else break
  }
  // 若请求 power 超过最高行,chosen 已是最后一行
  return chosen
}
