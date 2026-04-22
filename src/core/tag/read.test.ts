import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { describe, expect, it } from 'vitest'
import { primaryTag, readTagInstances, resolveTags, sortByOrder } from './read'

function ch(params: { label: string, value: string }[]): CcfoliaCharacter {
  return { _id: 'x', roomId: 'r', name: 'X', status: [], params } as CcfoliaCharacter
}

const ally: TagDefinition = { id: 'builtin.ally', label: '盟友', color: '#3498db', order: 0, builtin: true }
const enemy: TagDefinition = { id: 'builtin.enemy', label: '敌人', color: '#e74c3c', order: 1, builtin: true }
const customBoss: TagDefinition = { id: 'custom.boss', label: 'Boss', color: '#f1c40f', order: 5, builtin: false }

describe('readTagInstances', () => {
  it('reads cs_tag_* entries and ignores others', () => {
    const char = ch([
      { label: 'cs_buff_xyz', value: '{}' },
      { label: 'cs_tag_builtin.ally', value: '{"attachedAt":100}' },
      { label: 'gm_note', value: 'keep' },
    ])
    expect(readTagInstances(char)).toEqual([{ definitionId: 'builtin.ally', attachedAt: 100 }])
  })

  it('skips entries with invalid JSON value', () => {
    const char = ch([{ label: 'cs_tag_custom.boss', value: '{not json' }])
    expect(readTagInstances(char)).toEqual([])
  })

  it('skips entries whose value parses to non-object (null / string / number)', () => {
    const char = ch([
      { label: 'cs_tag_a', value: 'null' },
      { label: 'cs_tag_b', value: '"string"' },
      { label: 'cs_tag_c', value: '42' },
    ])
    expect(readTagInstances(char)).toEqual([])
  })

  it('defaults attachedAt to 0 when field is missing or non-number', () => {
    const char = ch([
      { label: 'cs_tag_a', value: '{}' },
      { label: 'cs_tag_b', value: '{"attachedAt":"not number"}' },
    ])
    expect(readTagInstances(char)).toEqual([
      { definitionId: 'a', attachedAt: 0 },
      { definitionId: 'b', attachedAt: 0 },
    ])
  })
})

describe('resolveTags', () => {
  it('drops instances whose definition is missing', () => {
    const byId = (id: string) => (id === 'builtin.ally' ? ally : undefined)
    const resolved = resolveTags(
      [{ definitionId: 'builtin.ally', attachedAt: 0 }, { definitionId: 'gone', attachedAt: 0 }],
      byId,
    )
    expect(resolved).toEqual([ally])
  })
})

describe('sortByOrder', () => {
  it('sorts ascending by order then id', () => {
    const tie: TagDefinition = { ...customBoss, id: 'custom.aaa', order: 1 }
    expect(sortByOrder([enemy, tie, ally, customBoss])).toEqual([ally, enemy, tie, customBoss])
  })
})

describe('primaryTag', () => {
  it('returns tag with smallest order', () => {
    expect(primaryTag([enemy, ally, customBoss])).toBe(ally)
  })

  it('returns null on empty', () => {
    expect(primaryTag([])).toBeNull()
  })
})
