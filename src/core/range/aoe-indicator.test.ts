import type { AoeIndicator } from './aoe-indicator'
import { describe, expect, it } from 'vitest'
import { tickAoeIndicators } from './aoe-indicator'

function make(id: string, turnsRemaining: number | null): AoeIndicator {
  return { id, characterId: 'c1', label: 'L', radiusM: 3, color: '#fff', turnsRemaining }
}

describe('tickAoeIndicators', () => {
  it('number 倒计时 -1', () => {
    const out = tickAoeIndicators([make('a', 3)])
    expect(out).toHaveLength(1)
    expect(out[0].turnsRemaining).toBe(2)
  })

  it('减到 0 被剔除', () => {
    expect(tickAoeIndicators([make('a', 1)])).toHaveLength(0)
  })

  it('null 永久保留且不变', () => {
    const out = tickAoeIndicators([make('a', null)])
    expect(out).toHaveLength(1)
    expect(out[0].turnsRemaining).toBeNull()
  })

  it('空数组 -> 空数组', () => {
    expect(tickAoeIndicators([])).toEqual([])
  })

  it('混合:永久保留、衰减、剔除', () => {
    const out = tickAoeIndicators([make('a', null), make('b', 2), make('c', 1)])
    expect(out.map(x => x.id)).toEqual(['a', 'b'])
    expect(out.find(x => x.id === 'b')!.turnsRemaining).toBe(1)
  })

  it('返回新数组,不原地改', () => {
    const input = [make('a', 3)]
    const out = tickAoeIndicators(input)
    expect(out).not.toBe(input)
    expect(input[0].turnsRemaining).toBe(3)
  })
})
