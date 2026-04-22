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
}
