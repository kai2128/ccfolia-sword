import type { Resolution } from './types'
import { describe, expect, it } from 'vitest'
import { formatActionLog } from './log-format'

describe('formatActionLog', () => {
  it('物理单目标 - 命中', () => {
    const resolution: Resolution = {
      draft: {
        id: '1',
        kind: 'physical',
        attacker: '格伦',
        actionName: '长剑挥砍',
        range: '',
        isAoe: false,
        aoeNote: '',
        resistOutcome: 'nullify',
        powerExpr: 'k40+3',
        critDice: [],
        attackRoll: 13,
        dice1: 6,
        dice2: 5,
        targets: [{ id: 'tA', name: '哥布林A', evasion: 10, defense: 2 }],
      },
      rawDamageBase: 17,
      targets: [{
        id: 'tA',
        name: '哥布林A',
        hit: true,
        rawDamage: 17,
        finalDamage: 15,
        isHitOverridden: false,
        isRawDamageOverridden: false,
        isFinalDamageOverridden: false,
      }],
    }

    expect(formatActionLog(resolution)).toMatchInlineSnapshot(`
      "【格伦 → 长剑挥砍】
       哥布林A(回避10)命中(13) 伤害 17-2 = 15"
    `)
  })

  it('物理单目标 - 未命中', () => {
    const resolution: Resolution = {
      draft: {
        id: '1',
        kind: 'physical',
        attacker: '格伦',
        actionName: '长剑挥砍',
        range: '',
        isAoe: false,
        aoeNote: '',
        resistOutcome: 'nullify',
        powerExpr: '',
        critDice: [],
        attackRoll: 9,
        targets: [{ id: 'tA', name: '哥布林A', evasion: 10 }],
      },
      rawDamageBase: null,
      targets: [{
        id: 'tA',
        name: '哥布林A',
        hit: false,
        rawDamage: null,
        finalDamage: 0,
        isHitOverridden: false,
        isRawDamageOverridden: false,
        isFinalDamageOverridden: false,
      }],
    }

    expect(formatActionLog(resolution)).toMatchInlineSnapshot(`
      "【格伦 → 长剑挥砍】
       哥布林A(回避10)未命中"
    `)
  })

  it('魔法 AoE - 混合抵抗结果', () => {
    const resolution: Resolution = {
      draft: {
        id: '1',
        kind: 'magic',
        attacker: '琳',
        actionName: '火球术',
        range: '30m',
        isAoe: true,
        aoeNote: '3m 半径',
        resistTarget: 'mental',
        resistOutcome: 'half',
        powerExpr: 'k30+2',
        critDice: [],
        castingRoll: 14,
        dice1: 5,
        dice2: 4,
        targets: [
          { id: 'a', name: '哥A', resistValue: 9 },
          { id: 'b', name: '哥B', resistValue: 15 },
          { id: 'c', name: '哥C', resistValue: 8 },
        ],
      },
      rawDamageBase: 10,
      targets: [
        { id: 'a', name: '哥A', hit: true, rawDamage: 10, finalDamage: 10, isHitOverridden: false, isRawDamageOverridden: false, isFinalDamageOverridden: false },
        { id: 'b', name: '哥B', hit: false, rawDamage: 10, finalDamage: 5, isHitOverridden: false, isRawDamageOverridden: false, isFinalDamageOverridden: false },
        { id: 'c', name: '哥C', hit: true, rawDamage: 10, finalDamage: 10, isHitOverridden: false, isRawDamageOverridden: false, isFinalDamageOverridden: false },
      ],
    }

    expect(formatActionLog(resolution)).toMatchInlineSnapshot(`
      "【琳 → 火球术(AoE)】行使 14
       哥A 抵抗 9 失败 10
       哥B 抵抗 15 成功 半伤 5
       哥C 抵抗 8 失败 10"
    `)
  })
})
