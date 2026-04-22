import type { Modifier, ModifierTarget } from '@/types/modifier'

export type { ModifierTarget }

export type ModifierDefinition = Pick<Modifier, 'target' | 'value'>

export type BuffScope = 'single' | 'aoe'
export type BuffLifecycle = 'encounter' | 'persistent'

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
