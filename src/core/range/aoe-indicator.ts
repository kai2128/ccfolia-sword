// AOE 领域指示器:锚定角色的持续区域效果(领域抗性 / 防护领域 等),
// 在现有射程圈之上叠一层符文阵。纯本地 userscript 语义,存 encounter.shared。
export interface AoeIndicator {
  id: string
  // 锚定角色;圆心 = 站立格中心(与 RangeCircle 一致),指示器随角色移动。
  characterId: string
  label: string
  // 半径(格 = 米),> 0
  radiusM: number
  // 环本体色 hex
  color: string
  // null = 永久;>= 1 每回合 -1,到 0 移除。表单把 空/0 归一成 null。
  turnsRemaining: number | null
}

// 回合衰减:turnsRemaining 为数字的 -1,衰减到 <= 0 的剔除;null 永久保留。
// 返回新数组,不原地修改(配合 Pinia 不可变替换触发持久化)。
export function tickAoeIndicators(list: AoeIndicator[]): AoeIndicator[] {
  const out: AoeIndicator[] = []
  for (const a of list) {
    if (a.turnsRemaining == null) {
      out.push(a)
      continue
    }
    const next = a.turnsRemaining - 1
    if (next > 0)
      out.push({ ...a, turnsRemaining: next })
  }
  return out
}
