// StoredCharacter ↔ RuntimeCharacter 双向转换
// 规则见 REQUIREMENTS §3.2
//
// 不变式(单测覆盖):
// 1. normalize(denormalize(rt)) === rt(结构深等)
// 2. normalize 后 parts.length ≥ 1,primaryPartId 总是 parts[0].id
// 3. 单部位 stored → isMultiPart=false,parts 长度=1
// 4. 多部位 stored → isMultiPart=true,parts 原样搬
// 5. 单部位 stored 缺字段时,零值兜底(不抛错),因为 StoredCharacter 的单部位字段都是可选

import type {
  AbilityScores,
  CharacterPart,
  CombatStats,
  HpMp,
  RuntimeCharacter,
  StoredCharacter,
} from '@/types/character'

const ZERO_HPMP: HpMp = { current: 0, max: 0 }

const ZERO_ABILITIES: AbilityScores = {
  dexterity: { value: 0, bonus: 0 },
  agility: { value: 0, bonus: 0 },
  strength: { value: 0, bonus: 0 },
  vitality: { value: 0, bonus: 0 },
  intelligence: { value: 0, bonus: 0 },
  will: { value: 0, bonus: 0 },
}

const ZERO_COMBAT: CombatStats = {
  evasion: 0,
  lifeResistance: 0,
  mentalResistance: 0,
  armor: 0,
}

// 单部位 stored 兜底的主 part id。基于 stored.id 确定性生成,
// normalize → denormalize → normalize 路径上该 id 保持稳定。
function primaryPartIdFor(storedId: string): string {
  return `${storedId}:main`
}

export function normalizeCharacter(stored: StoredCharacter): RuntimeCharacter {
  const { parts, hp, mp, abilities, combat, defaultInitiative, ...rest } = stored
  const hasParts = Array.isArray(parts) && parts.length > 0

  const runtimeParts: CharacterPart[] = hasParts
    ? parts!.map(p => ({ ...p }))
    : [{
        id: primaryPartIdFor(stored.id),
        name: stored.name,
        hp: hp ?? { ...ZERO_HPMP },
        mp: mp ?? { ...ZERO_HPMP },
        abilities: abilities ?? structuredClone(ZERO_ABILITIES),
        combat: combat ?? { ...ZERO_COMBAT },
        defaultInitiative,
      }]

  return {
    id: rest.id,
    ccfoliaCharacterId: rest.ccfoliaCharacterId,
    name: rest.name,
    nickname: rest.nickname,
    faction: rest.faction,
    control: rest.control,
    memo: rest.memo,
    classes: rest.classes,
    skills: rest.skills,
    equipment: rest.equipment,
    inventory: rest.inventory,
    gold: rest.gold,
    palette: rest.palette,
    parts: runtimeParts,
    isMultiPart: hasParts,
    primaryPartId: runtimeParts[0].id,
  }
}

export function denormalizeCharacter(runtime: RuntimeCharacter): StoredCharacter {
  const base: StoredCharacter = {
    id: runtime.id,
    ccfoliaCharacterId: runtime.ccfoliaCharacterId,
    name: runtime.name,
    nickname: runtime.nickname,
    faction: runtime.faction,
    control: runtime.control,
    memo: runtime.memo,
    classes: runtime.classes,
    skills: runtime.skills,
    equipment: runtime.equipment,
    inventory: runtime.inventory,
    gold: runtime.gold,
    palette: runtime.palette,
  }

  if (runtime.isMultiPart) {
    // 多部位形态:parts 直接回存,不回填平铺字段
    base.parts = runtime.parts.map(p => ({ ...p }))
    return base
  }

  // 单部位形态:把 parts[0] 拆回平铺字段,不写 parts
  const main = runtime.parts[0]
  base.hp = { ...main.hp }
  base.mp = { ...main.mp }
  base.abilities = structuredClone(main.abilities)
  base.combat = { ...main.combat }
  base.defaultInitiative = main.defaultInitiative
  return base
}
