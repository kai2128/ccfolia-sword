// 导入 JSON 时的 runtime 校验。返回 { ok: true } 或 { ok: false, field, message }。
// 目标是拦明显畸形的 payload,不做类型全覆盖 —— TypeScript 用不上,因为这是运行时入口。
//
// 校验规则:
// - id / name:必填 string
// - faction:'friendly' | 'enemy' | 'neutral'
// - control:'pc' | 'gm'
// - classes / skills / inventory / palette:必须是数组(可空)
// - equipment:必须是对象,weapons/accessories 必须是数组
// - 如果出现 hp/mp:current 和 max 都必须是 number
// - 如果出现 abilities:6 围每项必须有 number value/bonus
// - 如果出现 combat:4 个字段必须是 number
// - 如果出现 parts:非空数组,每项必须有 id/name/hp/mp/abilities/combat
//
// 失败时 field 指向第一个错处(支持 "parts[0].hp.max" 这种路径),
// 调用方据此向用户提示。

import type { AbilityScores, CharacterPart, CombatStats, HpMp, StoredCharacter } from '@/types/character'

export type ValidateResult =
  | { ok: true }
  | { ok: false, field: string, message: string }

function err(field: string, message: string): ValidateResult {
  return { ok: false, field, message }
}

function isHpMp(v: unknown, prefix: string): ValidateResult {
  if (!v || typeof v !== 'object')
    return err(prefix, 'expected object')
  const o = v as Record<string, unknown>
  if (typeof o.current !== 'number')
    return err(`${prefix}.current`, 'expected number')
  if (typeof o.max !== 'number')
    return err(`${prefix}.max`, 'expected number')
  return { ok: true }
}

function isAbilities(v: unknown, prefix: string): ValidateResult {
  if (!v || typeof v !== 'object')
    return err(prefix, 'expected object')
  const o = v as Record<string, unknown>
  const keys = ['dexterity', 'agility', 'strength', 'vitality', 'intelligence', 'will'] as const
  for (const k of keys) {
    const a = o[k] as Record<string, unknown> | undefined
    if (!a || typeof a !== 'object')
      return err(`${prefix}.${k}`, 'expected object')
    if (typeof a.value !== 'number')
      return err(`${prefix}.${k}.value`, 'expected number')
    if (typeof a.bonus !== 'number')
      return err(`${prefix}.${k}.bonus`, 'expected number')
  }
  return { ok: true }
}

function isCombat(v: unknown, prefix: string): ValidateResult {
  if (!v || typeof v !== 'object')
    return err(prefix, 'expected object')
  const o = v as Record<string, unknown>
  for (const k of ['evasion', 'lifeResistance', 'mentalResistance', 'armor']) {
    if (typeof o[k] !== 'number')
      return err(`${prefix}.${k}`, 'expected number')
  }
  return { ok: true }
}

function isPart(v: unknown, prefix: string): ValidateResult {
  if (!v || typeof v !== 'object')
    return err(prefix, 'expected object')
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string')
    return err(`${prefix}.id`, 'expected string')
  if (typeof o.name !== 'string')
    return err(`${prefix}.name`, 'expected string')
  const hpR = isHpMp(o.hp, `${prefix}.hp`)
  if (!hpR.ok)
    return hpR
  const mpR = isHpMp(o.mp, `${prefix}.mp`)
  if (!mpR.ok)
    return mpR
  const abR = isAbilities(o.abilities, `${prefix}.abilities`)
  if (!abR.ok)
    return abR
  const cbR = isCombat(o.combat, `${prefix}.combat`)
  if (!cbR.ok)
    return cbR
  return { ok: true }
}

export function validateStoredCharacter(c: unknown): ValidateResult {
  if (!c || typeof c !== 'object')
    return err('', 'expected object')
  const o = c as Record<string, unknown>

  if (typeof o.id !== 'string' || !o.id)
    return err('id', 'expected non-empty string')
  if (typeof o.name !== 'string' || !o.name)
    return err('name', 'expected non-empty string')
  if (o.faction !== 'friendly' && o.faction !== 'enemy' && o.faction !== 'neutral')
    return err('faction', 'expected friendly | enemy | neutral')
  if (o.control !== 'pc' && o.control !== 'gm')
    return err('control', 'expected pc | gm')

  for (const k of ['classes', 'skills', 'inventory', 'palette']) {
    if (o[k] !== undefined && !Array.isArray(o[k]))
      return err(k, 'expected array')
  }

  if (o.equipment !== undefined) {
    const eq = o.equipment as Record<string, unknown>
    if (!eq || typeof eq !== 'object')
      return err('equipment', 'expected object')
    if (eq.weapons !== undefined && !Array.isArray(eq.weapons))
      return err('equipment.weapons', 'expected array')
    if (eq.accessories !== undefined && !Array.isArray(eq.accessories))
      return err('equipment.accessories', 'expected array')
  }

  if (o.hp !== undefined) {
    const r = isHpMp(o.hp, 'hp')
    if (!r.ok)
      return r
  }
  if (o.mp !== undefined) {
    const r = isHpMp(o.mp, 'mp')
    if (!r.ok)
      return r
  }
  if (o.abilities !== undefined) {
    const r = isAbilities(o.abilities, 'abilities')
    if (!r.ok)
      return r
  }
  if (o.combat !== undefined) {
    const r = isCombat(o.combat, 'combat')
    if (!r.ok)
      return r
  }

  if (o.parts !== undefined) {
    if (!Array.isArray(o.parts) || o.parts.length === 0)
      return err('parts', 'expected non-empty array')
    for (let i = 0; i < o.parts.length; i++) {
      const r = isPart(o.parts[i], `parts[${i}]`)
      if (!r.ok)
        return r
    }
  }

  return { ok: true }
}

// 未使用的 import 声明,让编辑器保留对 StoredCharacter 等类型的跳转 —— 纯文档用途
export type { AbilityScores, CharacterPart, CombatStats, HpMp, StoredCharacter }
