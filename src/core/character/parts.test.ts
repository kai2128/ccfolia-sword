import type { CcfoliaCharacter } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot/default-label-map'
import { extractParts } from './parts'

function mkChar(status: Array<{ label: string, value?: number, max?: number }>): CcfoliaCharacter {
  return {
    _id: 'c1',
    roomId: 'r1',
    name: 'test',
    status: status.map(s => ({ label: s.label, value: s.value ?? 0, max: s.max ?? 1 })),
    params: [],
  }
}

describe('extractParts', () => {
  it('单部位标准:HP + MP → 单条 partKey=空', () => {
    const char = mkChar([{ label: 'HP' }, { label: 'MP' }])
    const parts = extractParts(char, DEFAULT_STATUS_LABEL_MAP)
    expect(parts).toEqual([
      { charId: 'c1', partKey: '', isMain: true, hpLabel: 'HP', mpLabel: 'MP', partName: '' },
    ])
  })

  it('单部位无 MP:返回 mpLabel=null', () => {
    const char = mkChar([{ label: 'HP' }])
    const parts = extractParts(char, DEFAULT_STATUS_LABEL_MAP)
    expect(parts[0].mpLabel).toBeNull()
  })

  it('无 HP 角色:退化为单条占位,hpLabel 走默认', () => {
    const char = mkChar([{ label: '防御' }])
    const parts = extractParts(char, DEFAULT_STATUS_LABEL_MAP)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ partKey: '', hpLabel: 'HP', mpLabel: null })
  })

  it('多部位标准:XX + 3 子部位,只 XX 有 MP', () => {
    const char = mkChar([
      { label: 'XXHP' },
      { label: 'XXMP' },
      { label: 'X1HP' },
      { label: 'X2HP' },
      { label: 'X3HP' },
    ])
    const parts = extractParts(char, DEFAULT_STATUS_LABEL_MAP)
    expect(parts).toHaveLength(4)
    expect(parts[0]).toMatchObject({ partKey: 'XX', isMain: true, hpLabel: 'XXHP', mpLabel: 'XXMP' })
    expect(parts[1]).toMatchObject({ partKey: 'X1', isMain: false, hpLabel: 'X1HP', mpLabel: null })
    expect(parts[2]).toMatchObject({ partKey: 'X2', isMain: false, hpLabel: 'X2HP', mpLabel: null })
    expect(parts[3]).toMatchObject({ partKey: 'X3', isMain: false, hpLabel: 'X3HP', mpLabel: null })
  })

  it('多部位部分有 MP:XX/X1 有 MP,X2 无', () => {
    const char = mkChar([
      { label: 'XXHP' },
      { label: 'XXMP' },
      { label: 'X1HP' },
      { label: 'X1MP' },
      { label: 'X2HP' },
    ])
    const parts = extractParts(char, DEFAULT_STATUS_LABEL_MAP)
    expect(parts).toHaveLength(3)
    expect(parts.map(p => p.mpLabel)).toEqual(['XXMP', 'X1MP', null])
  })

  it('自定义 labelMap:hp 的 label 改成繁体,识别照常', () => {
    const char = mkChar([{ label: 'XX生命' }, { label: 'X1生命' }])
    const parts = extractParts(char, { ...DEFAULT_STATUS_LABEL_MAP, hp: '生命' })
    expect(parts).toHaveLength(2)
    expect(parts.map(p => p.partKey)).toEqual(['XX', 'X1'])
  })

  it('保持首次出现顺序(GM 把子部位写在前)', () => {
    const char = mkChar([
      { label: 'X1HP' },
      { label: 'XXHP' },
      { label: 'XXMP' },
    ])
    const parts = extractParts(char, DEFAULT_STATUS_LABEL_MAP)
    expect(parts.map(p => p.partKey)).toEqual(['X1', 'XX'])
    expect(parts[0].isMain).toBe(true) // X1 在前 → 它是 main
  })
})
