// 运行时 Modifier 模型,对齐 REQUIREMENTS §6
// BuffPayload(ccfolia params 持久化形态)在 types/buff.ts,lifecycle 字段命名已统一,
// 两者语义相同但用途不同(Buff 是语义包装,Modifier 是数值原子),不要混用。

export type ModifierTarget
  = | 'attack'
    | 'evasion'
    | 'damage'
    | 'casting'
    | 'resist-life'
    | 'resist-mental'
    | 'dexterity' // 器用
    | 'agility' // 敏捷
    | 'strength' // 筋力
    | 'vitality' // 生命
    | 'intelligence' // 知力
    | 'will' // 精神
    | 'armor'
    | 'max-hp'
    | 'max-mp'
    | 'custom'

export type ModifierLifecycle
  = | { kind: 'permanent' }
    | { kind: 'turns', remaining: number }
    | { kind: 'once', consumed: boolean }
    | { kind: 'manual' }

export interface Modifier {
  id: string
  target: ModifierTarget
  value: number
  source: string // 人类可读的来源描述(如 "祝福"、"GM 手加")
  lifecycle: ModifierLifecycle
  note?: string
}
