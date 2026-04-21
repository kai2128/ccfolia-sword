export type ResistType = 'evasion' | 'mental' | 'life' | 'none'
export type DamageType = 'physical' | 'magical'
export type ResistResult = 'success' | 'failure'
export type ResistOutcome = 'nullify' | 'half'

export interface ActionTarget {
  characterId: string
  resistResult?: ResistResult
  resistOutcome?: ResistOutcome
  finalValueOverride?: number
}

export interface ActionDraft {
  id: string
  kind: 'damage' | 'heal'
  damageType?: DamageType
  rawValue: number
  actorCharacterId?: string
  mpCost?: number
  resistType: ResistType
  note?: string
  targets: ActionTarget[]
}

export class InvalidDraftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDraftError'
  }
}
