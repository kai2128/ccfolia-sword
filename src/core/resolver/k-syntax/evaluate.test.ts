import type { PowerTable } from '@/types/power-table'
import { describe, expect, it } from 'vitest'
import { evaluatePowerCommand } from './evaluate'

const table: PowerTable = {
  id: 't',
  name: 't',
  entries: [
    { power: 0, rolls: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6] },
    { power: 10, rolls: [1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { power: 20, rolls: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    { power: 40, rolls: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  ],
}

describe('evaluatePowerCommand', () => {
  it('无暴击、无修正时等于查表值', () => {
    const result = evaluatePowerCommand(
      { power: 40, critThreshold: 10, modifier: 0, half: false },
      table,
      { main: [6, 5], crits: [] },
    )
    expect(result.total).toBe(14)
    expect(result.baseDamage).toBe(14)
  })

  it('修正：total = base + modifier', () => {
    const result = evaluatePowerCommand(
      { power: 40, critThreshold: 10, modifier: 3, half: false },
      table,
      { main: [4, 3], crits: [] },
    )
    expect(result.baseDamage).toBe(10)
    expect(result.total).toBe(13)
  })

  it('暴击累加：主骰与每次 crit 各自查表后累加', () => {
    const result = evaluatePowerCommand(
      { power: 40, critThreshold: 10, modifier: 0, half: false },
      table,
      { main: [6, 5], crits: [[4, 3]] },
    )
    expect(result.baseDamage).toBe(24)
    expect(result.total).toBe(24)
  })

  it('多轮暴击：连续累加', () => {
    const result = evaluatePowerCommand(
      { power: 40, critThreshold: 10, modifier: 0, half: false },
      table,
      { main: [6, 5], crits: [[4, 3], [5, 5]] },
    )
    expect(result.baseDamage).toBe(37)
  })

  it('半减：先 floor(base / 2) 再加修正', () => {
    const result = evaluatePowerCommand(
      { power: 30, critThreshold: 13, modifier: 2, half: true },
      table,
      { main: [5, 4], crits: [] },
    )
    expect(result.baseDamage).toBe(10)
    expect(result.total).toBe(7)
  })

  it('半减 + 暴击累加：先累加 base 再减半', () => {
    const result = evaluatePowerCommand(
      { power: 40, critThreshold: 13, modifier: 0, half: true },
      table,
      { main: [6, 5], crits: [[4, 3]] },
    )
    expect(result.baseDamage).toBe(24)
    expect(result.total).toBe(12)
  })

  it('负修正可让总伤害为负，不在此层夹 0', () => {
    const result = evaluatePowerCommand(
      { power: 0, critThreshold: 10, modifier: -5, half: false },
      table,
      { main: [2, 2], crits: [] },
    )
    expect(result.total).toBe(-4)
  })

  it('breakdown 包含威力、骰值和修正痕迹', () => {
    const result = evaluatePowerCommand(
      { power: 40, critThreshold: 10, modifier: 3, half: false },
      table,
      { main: [6, 5], crits: [[4, 3]] },
    )
    expect(result.breakdown).toContain('40')
    expect(result.breakdown).toContain('6+5')
    expect(result.breakdown).toContain('+3')
  })
})
