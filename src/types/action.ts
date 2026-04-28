export type ResistType = 'evasion' | 'mental' | 'life' | 'none'
export type DamageType = 'physical' | 'magical'
export type ResistResult = 'success' | 'failure'
export type ResistOutcome = 'nullify' | 'half'

export interface ActionTarget {
  characterId: string
  // 多部位时指明部位前缀(如 'XX' / 'X1');省略 / '' = 整体单部位
  partKey?: string
  resistResult?: ResistResult
  resistOutcome?: ResistOutcome
  // 临时加值/减值,叠加进公式;非负整数。finalValueOverride 生效时被忽略。
  bonus?: number
  penalty?: number
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
