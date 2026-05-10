import type { CcfoliaStatus } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { extractStatusChips, matchStatusPattern, STATUS_PATTERNS } from './status-chip'

function s(label: string, value: number, max = 0): CcfoliaStatus {
  return { label, value, max }
}

describe('matchStatusPattern', () => {
  it('matches exact prefix', () => {
    expect(matchStatusPattern('高昂')?.glyph).toBe('昂')
    expect(matchStatusPattern('镇静')?.glyph).toBe('镇')
    expect(matchStatusPattern('魅惑')?.glyph).toBe('魅')
  })

  it('matches startsWith with suffix', () => {
    expect(matchStatusPattern('高昂+1')?.polarity).toBe('buff')
    expect(matchStatusPattern('镇静(2)')?.glyph).toBe('镇')
    expect(matchStatusPattern('魅惑·deep')?.polarity).toBe('debuff')
  })

  it('rejects non-matches', () => {
    expect(matchStatusPattern('HP')).toBeNull()
    expect(matchStatusPattern('MP')).toBeNull()
    expect(matchStatusPattern('防御')).toBeNull()
    // 繁体不算命中(简体码点不同)
    expect(matchStatusPattern('高揚')).toBeNull()
    // 不能用单字模糊匹配
    expect(matchStatusPattern('镇')).toBeNull()
  })
})

describe('extractStatusChips', () => {
  it('returns empty for no matches', () => {
    expect(extractStatusChips([s('HP', 10), s('MP', 5)])).toEqual([])
  })

  it('preserves value from the entry', () => {
    const out = extractStatusChips([s('HP', 10), s('高昂', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('高昂')
    expect(out[0].value).toBe(2)
    expect(out[0].record.glyph).toBe('昂')
  })

  it('returns multiple chips when multiple match', () => {
    const out = extractStatusChips([
      s('HP', 10),
      s('高昂', 1),
      s('镇静', 3),
      s('魅惑+1', 2),
    ])
    expect(out.map(i => i.label)).toEqual(['高昂', '镇静', '魅惑+1'])
  })

  it('keeps array order from input (no sorting)', () => {
    const out = extractStatusChips([s('魅惑', 1), s('高昂', 2)])
    expect(out.map(i => i.label)).toEqual(['魅惑', '高昂'])
  })

  it('first-match-wins: a label only counts once', () => {
    // STATUS_PATTERNS 顺序保证:即便后续加 prefix 也不会重复 push
    expect(STATUS_PATTERNS.length).toBe(3)
    const out = extractStatusChips([s('高昂', 1)])
    expect(out).toHaveLength(1)
  })
})
