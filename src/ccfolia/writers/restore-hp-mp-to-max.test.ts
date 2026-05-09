import type { CcfoliaCharacter } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'
import { computeRestoredStatus } from './restore-hp-mp-to-max'

function char(status: CcfoliaCharacter['status']): CcfoliaCharacter {
  return {
    _id: 'c1',
    roomId: 'room-1',
    name: 'C',
    status,
    params: [],
  }
}

describe('computeRestoredStatus', () => {
  it('单部位:HP 与 MP 同时回满', () => {
    const c = char([
      { label: 'HP', value: 3, max: 25 },
      { label: 'MP', value: 1, max: 12 },
    ])
    const { nextStatus, changed } = computeRestoredStatus(c, DEFAULT_STATUS_LABEL_MAP)
    expect(changed).toBe(true)
    expect(nextStatus).toEqual([
      { label: 'HP', value: 25, max: 25 },
      { label: 'MP', value: 12, max: 12 },
    ])
  })

  it('已经在 max 时不视为变更(避免空写)', () => {
    const c = char([
      { label: 'HP', value: 25, max: 25 },
      { label: 'MP', value: 12, max: 12 },
    ])
    const { changed } = computeRestoredStatus(c, DEFAULT_STATUS_LABEL_MAP)
    expect(changed).toBe(false)
  })

  it('多部位:每个 part 的 HP / MP 各自回满,非 HP/MP 字段保持不动', () => {
    const c = char([
      { label: 'main_HP', value: 1, max: 30 },
      { label: 'main_MP', value: 0, max: 10 },
      { label: 'tail_HP', value: 0, max: 8 },
      { label: '防護点', value: 4, max: 4 },
    ])
    const { nextStatus, changed } = computeRestoredStatus(c, DEFAULT_STATUS_LABEL_MAP)
    expect(changed).toBe(true)
    expect(nextStatus).toEqual([
      { label: 'main_HP', value: 30, max: 30 },
      { label: 'main_MP', value: 10, max: 10 },
      { label: 'tail_HP', value: 8, max: 8 },
      { label: '防護点', value: 4, max: 4 },
    ])
  })

  it('max 缺失或非有限数时跳过该条目', () => {
    const c = char([
      { label: 'HP', value: 0, max: Number.NaN },
      { label: 'MP', value: 0, max: 5 },
    ])
    const { nextStatus, changed } = computeRestoredStatus(c, DEFAULT_STATUS_LABEL_MAP)
    expect(changed).toBe(true)
    expect(nextStatus[0]).toEqual({ label: 'HP', value: 0, max: Number.NaN })
    expect(nextStatus[1]).toEqual({ label: 'MP', value: 5, max: 5 })
  })
})
