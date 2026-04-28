import type { ActionDraft, Target } from './types'
import type { PowerTable } from '@/types/power-table'
import { describe, expect, it } from 'vitest'
import { resolve } from './resolve'
import { makeBlankDraft, makeBlankTarget } from './types'

const table: PowerTable = {
  id: 't',
  name: 't',
  entries: [
    { power: 0, rolls: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6] },
    { power: 40, rolls: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  ],
}

const tables: Record<string, PowerTable> = { t: table }

function physicalDraft(overrides: Partial<ActionDraft> = {}, targets: Target[] = []): ActionDraft {
  return {
    ...makeBlankDraft(),
    kind: 'physical',
    powerTableId: 't',
    ...overrides,
    targets,
  }
}

function magicDraft(overrides: Partial<ActionDraft> = {}, targets: Target[] = []): ActionDraft {
  return {
    ...makeBlankDraft(),
    kind: 'magic',
    powerTableId: 't',
    resistTarget: 'mental',
    ...overrides,
    targets,
  }
}

function mkTarget(overrides: Partial<Target>): Target {
  return {
    ...makeBlankTarget(),
    ...overrides,
  }
}

describe('resolve - physical', () => {
  it('空 draft：targets 为空、rawDamageBase 为 null', () => {
    const result = resolve(physicalDraft(), tables)
    expect(result.targets).toEqual([])
    expect(result.rawDamageBase).toBeNull()
  })

  it('完整输入：命中成功后扣防御得到最终伤害', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'k40+3', dice1: 6, dice2: 5 },
      [mkTarget({ name: '哥布林A', evasion: 10, defense: 2 })],
    )
    const result = resolve(draft, tables)
    expect(result.rawDamageBase).toBe(17)
    expect(result.targets[0]).toMatchObject({
      hit: true,
      rawDamage: 17,
      finalDamage: 15,
    })
  })

  it('未命中：finalDamage = 0，但 rawDamage 仍可计算', () => {
    const draft = physicalDraft(
      { attackRoll: 9, powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ evasion: 10, defense: 2 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: false,
      rawDamage: 14,
      finalDamage: 0,
    })
  })

  it('防御会夹到 0', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'k0', dice1: 2, dice2: 2 },
      [mkTarget({ evasion: 10, defense: 100 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0].finalDamage).toBe(0)
  })

  it('缺攻击骰或回避时，hit = unknown，finalDamage = null', () => {
    const draft = physicalDraft(
      { powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ defense: 2 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: 'unknown',
      rawDamage: 14,
      finalDamage: null,
    })
  })

  it('aoE 多目标共享 rawDamageBase', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'k40', dice1: 6, dice2: 5, isAoe: true },
      [
        mkTarget({ evasion: 10, defense: 2 }),
        mkTarget({ evasion: 10, defense: 5 }),
      ],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({ rawDamage: 14, finalDamage: 12 })
    expect(result.targets[1]).toMatchObject({ rawDamage: 14, finalDamage: 9 })
  })

  it('hitOverride 可以强制命中', () => {
    const draft = physicalDraft(
      { attackRoll: 9, powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ evasion: 10, defense: 2, hitOverride: true })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: true,
      isHitOverridden: true,
      finalDamage: 12,
    })
  })

  it('rawDamageOverride 会覆盖自动原伤害', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ evasion: 10, defense: 2, rawDamageOverride: 50 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      rawDamage: 50,
      isRawDamageOverridden: true,
      finalDamage: 48,
    })
  })

  it('finalDamageOverride 会盖过最终结果', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ evasion: 10, defense: 2, finalDamageOverride: 99 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      finalDamage: 99,
      isFinalDamageOverridden: true,
    })
  })

  it('k 语法非法时返回 parseError 且不继续下游计算', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'kk40', dice1: 6, dice2: 5 },
      [mkTarget({ evasion: 10, defense: 2 })],
    )
    const result = resolve(draft, tables)
    expect(result.parseError).toBeTruthy()
    expect(result.rawDamageBase).toBeNull()
    expect(result.targets[0]).toMatchObject({
      rawDamage: null,
      finalDamage: null,
    })
  })

  it('威力表不存在时 rawDamageBase 为 null 且不抛错', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: 'k40', dice1: 6, dice2: 5, powerTableId: 'missing' },
      [mkTarget({ evasion: 10, defense: 2 })],
    )
    const result = resolve(draft, tables)
    expect(result.rawDamageBase).toBeNull()
  })

  it('powerExpr 为空时 rawDamageBase 为 null 且没有 parseError', () => {
    const draft = physicalDraft(
      { attackRoll: 13, powerExpr: '', dice1: 6, dice2: 5 },
      [mkTarget({ evasion: 10, defense: 2 })],
    )
    const result = resolve(draft, tables)
    expect(result.rawDamageBase).toBeNull()
    expect(result.parseError).toBeUndefined()
  })
})

describe('resolve - magic', () => {
  it('抵抗失败时全额伤害，不减任何防御', () => {
    const draft = magicDraft(
      { castingRoll: 14, powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ name: '哥A', resistValue: 9 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: true,
      finalDamage: 14,
    })
  })

  it('抵抗成功 + 无效时 finalDamage = 0', () => {
    const draft = magicDraft(
      { castingRoll: 14, resistOutcome: 'nullify', powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ resistValue: 15 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: false,
      finalDamage: 0,
    })
  })

  it('抵抗成功 + 半伤时向上取整', () => {
    const draft = magicDraft(
      { castingRoll: 14, resistOutcome: 'half', powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ resistValue: 15 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0].finalDamage).toBe(7)
  })

  it('aoE 逐目标独立抵抗', () => {
    const draft = magicDraft(
      { castingRoll: 14, resistOutcome: 'half', powerExpr: 'k40', dice1: 6, dice2: 5, isAoe: true },
      [
        mkTarget({ name: 'A', resistValue: 9 }),
        mkTarget({ name: 'B', resistValue: 15 }),
        mkTarget({ name: 'C', resistValue: 8 }),
      ],
    )
    const result = resolve(draft, tables)
    expect(result.targets.map(target => target.finalDamage)).toEqual([14, 7, 14])
  })

  it('缺行使值或抵抗值时 hit = unknown，finalDamage = null', () => {
    const draft = magicDraft(
      { powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({})],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: 'unknown',
      finalDamage: null,
    })
  })

  it('hitOverride = false 等同于手动判定抵抗成功', () => {
    const draft = magicDraft(
      { castingRoll: 14, resistOutcome: 'nullify', powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ resistValue: 9, hitOverride: false })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0]).toMatchObject({
      hit: false,
      finalDamage: 0,
    })
  })

  it('finalDamageOverride 会覆盖魔法规则分支', () => {
    const draft = magicDraft(
      { castingRoll: 14, resistOutcome: 'nullify', powerExpr: 'k40', dice1: 6, dice2: 5 },
      [mkTarget({ resistValue: 15, finalDamageOverride: 77 })],
    )
    const result = resolve(draft, tables)
    expect(result.targets[0].finalDamage).toBe(77)
  })
})
