// 测试数据工厂。单部位 PC、单部位怪、多部位龙三种。

import type {
  AbilityScore,
  AbilityScores,
  CharacterPart,
  Equipment,
  StoredCharacter,
} from '@/types/character'

function ability(value: number): AbilityScore {
  return { value, bonus: Math.floor(value / 6) }
}

function abilities(v: number): AbilityScores {
  return {
    dexterity: ability(v),
    agility: ability(v),
    strength: ability(v),
    vitality: ability(v),
    intelligence: ability(v),
    will: ability(v),
  }
}

const EMPTY_EQUIPMENT: Equipment = { weapons: [], accessories: [] }

export function makePc(overrides: Partial<StoredCharacter> = {}): StoredCharacter {
  return {
    id: 'pc-glenn',
    name: '格伦',
    faction: 'friendly',
    control: 'pc',
    classes: [{ id: 'c1', name: '战士', level: 3 }],
    skills: [],
    equipment: EMPTY_EQUIPMENT,
    inventory: [],
    palette: [],
    hp: { current: 30, max: 30 },
    mp: { current: 10, max: 10 },
    abilities: abilities(12),
    combat: { evasion: 10, lifeResistance: 8, mentalResistance: 6, armor: 3 },
    defaultInitiative: 11,
    ...overrides,
  }
}

export function makeGoblin(overrides: Partial<StoredCharacter> = {}): StoredCharacter {
  return {
    id: 'npc-goblin-a',
    name: '哥布林A',
    faction: 'enemy',
    control: 'gm',
    classes: [],
    skills: [],
    equipment: EMPTY_EQUIPMENT,
    inventory: [],
    palette: [],
    hp: { current: 8, max: 8 },
    mp: { current: 0, max: 0 },
    abilities: abilities(6),
    combat: { evasion: 7, lifeResistance: 5, mentalResistance: 3, armor: 1 },
    defaultInitiative: 8,
    ...overrides,
  }
}

function dragonPart(id: string, name: string, hpMax: number): CharacterPart {
  return {
    id,
    name,
    hp: { current: hpMax, max: hpMax },
    mp: { current: 0, max: 0 },
    abilities: abilities(18),
    combat: { evasion: 12, lifeResistance: 14, mentalResistance: 10, armor: 8 },
    defaultInitiative: 15,
  }
}

export function makeDragon(overrides: Partial<StoredCharacter> = {}): StoredCharacter {
  return {
    id: 'boss-dragon',
    name: '火龙',
    faction: 'enemy',
    control: 'gm',
    classes: [],
    skills: [],
    equipment: EMPTY_EQUIPMENT,
    inventory: [],
    palette: [],
    parts: [
      dragonPart('boss-dragon:body', '本体', 120),
      dragonPart('boss-dragon:head', '头', 40),
      dragonPart('boss-dragon:tail', '尾', 30),
    ],
    ...overrides,
  }
}
