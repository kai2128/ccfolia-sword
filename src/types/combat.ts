// 战斗模型,对齐 REQUIREMENTS §3.3 §3.6 §4

import type { CharacterPart } from './character'
import type { Modifier } from './modifier'
import type { StatusEffectInstance } from './status-effect'

export type CombatPhase
  = | 'attack'
    | 'evasion'
    | 'damage'
    | 'casting'
    | 'resist-life'
    | 'resist-mental'
    | 'generic'

export type EncounterPhase
  = | 'pre-battle'
    | 'round-start'
    | 'action'
    | 'round-end'
    | 'ended'

export interface Combatant {
  id: string
  characterId: string
  partId: string
  snapshot: CharacterPart
  display: {
    name: string
    color?: string
  }
  currentHp: number
  currentMp: number
  modifiers: Modifier[] // 内存态,不进 ccfolia params
  statusEffects: StatusEffectInstance[] // 同步到 ccfolia params
  hasActed: boolean
  downed: boolean
}

export interface PendingRoll {
  combatantId: string
  phase: CombatPhase
  expression?: string
  modifiersReminder: string[]
  targetValue?: number
  targetCombatantId?: string
}

export type LogEntryType
  = | 'action'
    | 'roll'
    | 'damage'
    | 'status'
    | 'modifier'
    | 'manual'
    | 'note'

export interface LogEntry {
  id: string
  round: number
  timestamp: string // ISO datetime
  type: LogEntryType
  text: string
  relatedIds?: string[]
}

export interface Encounter {
  id: string
  name: string
  startedAt: string
  endedAt?: string
  combatants: Combatant[]
  turnOrder: string[]
  currentRound: number
  currentTurnIndex: number
  phase: EncounterPhase
  pendingRoll?: PendingRoll
  log: LogEntry[]
}
