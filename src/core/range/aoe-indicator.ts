// AOE 领域指示器:锚定角色的持续区域效果(领域抗性 / 防护领域 等),
// 在现有射程圈之上叠一层符文阵。
//
// 存储:和 buff 一样,作为 `cs_aoe_<id>` 条目写进「锚定角色」的 ccfolia params,
// 靠 ccfolia 自己的 onSnapshot 跨端 / 跨 tab 同步(不走 GM_setValue)。见 aoe-codec.ts。
export interface AoeIndicator {
  id: string
  // 锚定角色;圆心 = 站立格中心(与 RangeCircle 一致),指示器随角色移动。
  // 渲染层从「持有该 param 的角色」反推,不入库(StoredAoe 不含此字段)。
  characterId: string
  label: string
  // 半径(格 = 米),> 0
  radiusM: number
  // 环本体色 hex
  color: string
  // null = 永久;>= 1 每回合 -1,到 0 移除。表单把 空/0 归一成 null。
  turnsRemaining: number | null
  // 像 buff 一样可隐藏:false = 场景上不画(仍留在列表里,可再显示)。缺省视为 true。
  enabled: boolean
}

// 入库形态:characterId 由宿主角色隐含,不存。
export type StoredAoe = Omit<AoeIndicator, 'characterId'>
