import type { CcfoliaStatus } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from './default-label-map'
import { readStatusMax, readStatusSlot, readStatusValue } from './read'

const typicalStatus: CcfoliaStatus[] = [
  { label: 'HP', value: 22, max: 25 },
  { label: 'MP', value: 8, max: 12 },
  { label: '防御', value: 5, max: 5 },
  { label: '精神抵抗', value: 12, max: 12 },
  { label: '生命抵抗', value: 10, max: 10 },
]

describe('readStatusValue', () => {
  it('reads HP current value', () => {
    expect(readStatusValue(typicalStatus, 'hp', DEFAULT_STATUS_LABEL_MAP)).toBe(22)
  })

  it('reads 防御 current value', () => {
    expect(readStatusValue(typicalStatus, 'defense', DEFAULT_STATUS_LABEL_MAP)).toBe(5)
  })

  it('returns null when label not found', () => {
    const partial = typicalStatus.filter(s => s.label !== '精神抵抗')
    expect(readStatusValue(partial, 'mentalResist', DEFAULT_STATUS_LABEL_MAP)).toBeNull()
  })

  it('respects custom label map', () => {
    const custom = { ...DEFAULT_STATUS_LABEL_MAP, hp: 'ＨＰ' }
    const status = [{ label: 'ＨＰ', value: 30, max: 30 }]
    expect(readStatusValue(status, 'hp', custom)).toBe(30)
  })

  it('returns first match when duplicates exist', () => {
    const dup: CcfoliaStatus[] = [
      { label: 'HP', value: 10, max: 10 },
      { label: 'HP', value: 999, max: 999 },
    ]
    expect(readStatusValue(dup, 'hp', DEFAULT_STATUS_LABEL_MAP)).toBe(10)
  })
})

describe('readStatusMax', () => {
  it('reads HP max', () => {
    expect(readStatusMax(typicalStatus, 'hp', DEFAULT_STATUS_LABEL_MAP)).toBe(25)
  })

  it('returns null when label not found', () => {
    expect(readStatusMax([], 'hp', DEFAULT_STATUS_LABEL_MAP)).toBeNull()
  })
})

describe('readStatusSlot', () => {
  it('returns { value, max } for HP', () => {
    expect(readStatusSlot(typicalStatus, 'hp', DEFAULT_STATUS_LABEL_MAP)).toEqual({
      value: 22,
      max: 25,
    })
  })

  it('returns null when label not found', () => {
    expect(readStatusSlot([], 'hp', DEFAULT_STATUS_LABEL_MAP)).toBeNull()
  })
})
