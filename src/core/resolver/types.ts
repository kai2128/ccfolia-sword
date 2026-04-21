// Action Resolver 的核心类型。详见 docs/design/resolver-v1-design.md §4。

export type ActionKind = 'physical' | 'magic'
export type ResistTarget = 'life' | 'mental'
export type ResistOutcome = 'nullify' | 'half'
// `hit` 在两种行动里语义不同：
// - physical: true/false = 是否命中
// - magic: true/false = 是否抵抗失败（true = 伤害生效）
export type HitStatus = boolean | 'unknown'

// 暴击累加骰：GM 每次确认触发暴击时手动追加一对 2d6。
export type CritRoll = [number, number]

export interface Target {
  id: string
  name: string
  evasion?: number
  defense?: number
  resistValue?: number
  hitOverride?: boolean
  rawDamageOverride?: number
  finalDamageOverride?: number
}

export interface ActionDraft {
  id: string
  kind: ActionKind
  attacker: string
  actionName: string
  range: string
  mpCost?: number
  isAoe: boolean
  aoeNote: string
  attackRoll?: number
  castingRoll?: number
  resistTarget?: ResistTarget
  resistOutcome: ResistOutcome
  // v1 简化路径：GM 自行查威力表后直接填入原伤害。
  rawDamage?: number
  // 下面字段目前 UI 未暴露，保留以便后续接入威力表/k 语法自动计算。
  powerExpr: string
  dice1?: number
  dice2?: number
  critDice: CritRoll[]
  powerTableId?: string
  targets: Target[]
}

export interface ResolvedTarget {
  id: string
  name: string
  // 复用 HitStatus：物理看“命中”，魔法看“抵抗失败”。
  hit: HitStatus
  rawDamage: number | null
  finalDamage: number | null
  isHitOverridden: boolean
  isRawDamageOverridden: boolean
  isFinalDamageOverridden: boolean
}

export interface Resolution {
  draft: ActionDraft
  rawDamageBase: number | null
  parseError?: string
  targets: ResolvedTarget[]
}

export function makeBlankDraft(): ActionDraft {
  return {
    id: crypto.randomUUID(),
    kind: 'physical',
    attacker: '',
    actionName: '',
    range: '',
    isAoe: false,
    aoeNote: '',
    resistOutcome: 'nullify',
    powerExpr: '',
    critDice: [],
    targets: [],
  }
}

export function makeBlankTarget(): Target {
  return {
    id: crypto.randomUUID(),
    name: '',
  }
}
