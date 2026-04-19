// 角色统一模型,对齐 REQUIREMENTS §3.2
// 双形态:
//   - StoredCharacter:GM_setValue 里的可序列化形态(单部位字段平铺 / 多部位 parts[])
//   - RuntimeCharacter:Pinia 运行时形态(永远 normalized 为 parts[] ≥ 1)
// 转换见 src/core/character/normalize.ts

export type Faction = 'friendly' | 'enemy' | 'neutral'
export type Control = 'pc' | 'gm'

export interface AbilityScore {
  value: number // 原始能力值
  bonus: number // 加值(通常为 floor(value/6))
}

export interface AbilityScores {
  dexterity: AbilityScore // 器用
  agility: AbilityScore // 敏捷
  strength: AbilityScore // 筋力
  vitality: AbilityScore // 生命
  intelligence: AbilityScore // 知力
  will: AbilityScore // 精神
}

export interface CombatStats {
  evasion: number
  lifeResistance: number
  mentalResistance: number
  armor: number
}

export interface HpMp {
  current: number
  max: number
}

export interface CharacterClass {
  id: string
  name: string // "战士" / "魔法师" / "神官" 等
  level: number
  experience?: number
}

export type SkillKind = 'tech' | 'spell' | 'feature' | 'passive'

export interface Skill {
  id: string
  name: string
  kind: SkillKind
  level?: number
  mpCost?: number
  description?: string
  tags?: string[]
}

export interface EquipmentSlot {
  id: string
  name: string
  note?: string
}

export interface Equipment {
  weapons: EquipmentSlot[]
  armor?: EquipmentSlot
  shield?: EquipmentSlot
  accessories: EquipmentSlot[]
}

export interface InventoryItem {
  id: string
  name: string
  count: number
  description?: string
}

export type CombatPhaseBinding
  = | 'attack'
    | 'evasion'
    | 'damage'
    | 'casting'
    | 'resist-life'
    | 'resist-mental'
    | 'generic'

export interface PaletteCommand {
  id: string
  expression: string
  label: string
  category?: string
  bindsTo?: CombatPhaseBinding
}

export interface PaletteCategory {
  id: string
  name: string
  commands: PaletteCommand[]
}

export interface CharacterPart {
  id: string
  name: string
  hp: HpMp
  mp: HpMp
  abilities: AbilityScores
  combat: CombatStats
  defaultInitiative?: number
}

export interface StoredCharacter {
  id: string
  ccfoliaCharacterId?: string
  name: string
  nickname?: string
  faction: Faction
  control: Control
  memo?: string

  classes: CharacterClass[]
  skills: Skill[]
  equipment: Equipment
  inventory: InventoryItem[]
  gold?: number
  palette: PaletteCategory[]

  // 形态 A:单部位 —— 字段平铺
  hp?: HpMp
  mp?: HpMp
  abilities?: AbilityScores
  combat?: CombatStats
  defaultInitiative?: number

  // 形态 B:多部位 —— parts 存在时优先使用;v1.1+ 激活
  parts?: CharacterPart[]
}

export interface RuntimeCharacter {
  id: string
  ccfoliaCharacterId?: string
  name: string
  nickname?: string
  faction: Faction
  control: Control
  memo?: string

  classes: CharacterClass[]
  skills: Skill[]
  equipment: Equipment
  inventory: InventoryItem[]
  gold?: number
  palette: PaletteCategory[]

  parts: CharacterPart[] // 永远 ≥ 1
  isMultiPart: boolean
  primaryPartId: string
}
