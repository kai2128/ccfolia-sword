import type { PowerTable } from '@/types/power-table'
import { describe, expect, it } from 'vitest'
import { lookupPowerDamage } from './lookup'

const mini: PowerTable = {
  id: 'mini',
  name: 'mini',
  entries: [
    { power: 0, rolls: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6] },
    { power: 10, rolls: [1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { power: 20, rolls: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  ],
}

describe('lookupPowerDamage', () => {
  it('精确命中 power 行,按骰值索引', () => {
    expect(lookupPowerDamage(mini, 10, 2)).toBe(1)
    expect(lookupPowerDamage(mini, 10, 7)).toBe(5)
    expect(lookupPowerDamage(mini, 10, 12)).toBe(10)
  })

  it('power 未精确匹配时,取不超过的最大行', () => {
    expect(lookupPowerDamage(mini, 15, 7)).toBe(5) // 取 power=10 行
    expect(lookupPowerDamage(mini, 5, 7)).toBe(3) // 取 power=0 行
  })

  it('power 超过表最高,取最后一行', () => {
    expect(lookupPowerDamage(mini, 100, 7)).toBe(8) // power=20 行
  })

  it('骰值越界抛错', () => {
    expect(() => lookupPowerDamage(mini, 10, 1)).toThrow()
    expect(() => lookupPowerDamage(mini, 10, 13)).toThrow()
  })

  it('空表抛错', () => {
    expect(() => lookupPowerDamage({ id: 'e', name: 'e', entries: [] }, 10, 7)).toThrow()
  })
})
