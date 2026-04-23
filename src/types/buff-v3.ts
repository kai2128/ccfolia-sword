import type { Modifier, ModifierTarget } from '@/types/modifier'

export type { ModifierTarget }

export type ModifierDefinition = Pick<Modifier, 'target' | 'value'>

export type BuffScope = 'single' | 'aoe'
export type BuffLifecycle = 'encounter' | 'persistent'
export type BuffPolarity = 'positive' | 'negative'

export interface StatusEffectDefinition {
  id: string
  name: string
  icon: string
  color?: string
  description: string
  defaultDuration?: number
  scope: BuffScope
  defaultAoeRadius?: number
  tickPrompt?: string
  modifiers: ModifierDefinition[]
  reminder?: string
  builtin?: boolean
  polarity: BuffPolarity
  // 行使值:可选,例如 CoC 技能成功率 / 自定义判定数值
  actionValue?: number
}

export interface BuffSnapshot {
  name: string
  icon: string
  color?: string
  description: string
  tickPrompt?: string
  modifiers: ModifierDefinition[]
  reminder?: string
  defaultAoeRadius?: number
  polarity: BuffPolarity
  actionValue?: number
}

export interface AttachSingle {
  kind: 'single'
  characterId: string
}

export interface AttachAoe {
  kind: 'aoe'
  centerCharacterId: string
  radius: number
  includeOverride?: string[]
  excludeOverride?: string[]
}

export type AttachTarget = AttachSingle | AttachAoe

export interface BuffInstance {
  id: string
  definitionId: string
  snapshot: BuffSnapshot
  attachedTo: AttachTarget
  lifecycle: BuffLifecycle
  enabled: boolean
  turnsRemaining?: number
  attachedAtTurn: number
  note?: string
  // 被死亡/隐身自动 disable 的标记。只有带这个标记的 buff 会在复活时被自动重启用;
  // GM 手动 toggle(setBuffEnabled)会清掉它,让 GM 意图优先。
  disabledByDeath?: boolean
}
