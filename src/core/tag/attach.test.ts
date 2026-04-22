import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { buildAttachTagParams, buildDetachTagParams } from './attach'

const other: CcfoliaParam = { label: 'cs_buff_abc', value: '{}' }
const gmFree: CcfoliaParam = { label: 'note', value: 'keep me' }

describe('buildAttachTagParams', () => {
  it('appends a new cs_tag_* entry with JSON payload', () => {
    const next = buildAttachTagParams([other, gmFree], 'builtin.ally', 100)
    expect(next).toHaveLength(3)
    const tag = next.find(param => param.label === 'cs_tag_builtin.ally')
    expect(tag).toBeTruthy()
    expect(JSON.parse(tag!.value)).toEqual({ attachedAt: 100 })
  })

  it('preserves non-cs_tag_* entries', () => {
    const next = buildAttachTagParams([other, gmFree], 'builtin.enemy', 1)
    expect(next).toContainEqual(other)
    expect(next).toContainEqual(gmFree)
  })

  it('is idempotent (re-attach replaces attachedAt, no duplicate)', () => {
    const first = buildAttachTagParams([], 'builtin.ally', 100)
    const second = buildAttachTagParams(first, 'builtin.ally', 200)
    const hits = second.filter(param => param.label === 'cs_tag_builtin.ally')
    expect(hits).toHaveLength(1)
    expect(JSON.parse(hits[0].value)).toEqual({ attachedAt: 200 })
  })
})

describe('buildDetachTagParams', () => {
  it('removes the matching cs_tag_* entry', () => {
    const attached = buildAttachTagParams([other], 'builtin.ally', 1)
    const detached = buildDetachTagParams(attached, 'builtin.ally')
    expect(detached).toEqual([other])
  })

  it('is no-op when tag not present', () => {
    expect(buildDetachTagParams([other], 'builtin.ally')).toEqual([other])
  })
})
