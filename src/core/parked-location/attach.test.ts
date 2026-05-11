import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { buildClearParkedParams, buildSaveParkedParams } from './attach'

const other: CcfoliaParam = { label: 'cs_tag_builtin.ally', value: '{}' }
const gmFree: CcfoliaParam = { label: 'note', value: 'keep me' }

describe('buildSaveParkedParams', () => {
  it('appends a cs_park entry with JSON payload', () => {
    const next = buildSaveParkedParams([other, gmFree], 100, 200, 1234)
    expect(next).toHaveLength(3)
    const park = next.find(p => p.label === 'cs_park')
    expect(park).toBeTruthy()
    expect(JSON.parse(park!.value)).toEqual({ x: 100, y: 200, savedAt: 1234 })
  })

  it('preserves non-cs_park entries', () => {
    const next = buildSaveParkedParams([other, gmFree], 1, 2, 3)
    expect(next).toContainEqual(other)
    expect(next).toContainEqual(gmFree)
  })

  it('is idempotent (re-save overwrites x/y/savedAt, no duplicate)', () => {
    const first = buildSaveParkedParams([], 10, 20, 100)
    const second = buildSaveParkedParams(first, 50, 60, 200)
    const hits = second.filter(p => p.label === 'cs_park')
    expect(hits).toHaveLength(1)
    expect(JSON.parse(hits[0].value)).toEqual({ x: 50, y: 60, savedAt: 200 })
  })
})

describe('buildClearParkedParams', () => {
  it('removes the cs_park entry', () => {
    const saved = buildSaveParkedParams([other], 1, 2, 3)
    expect(buildClearParkedParams(saved)).toEqual([other])
  })

  it('is no-op when no cs_park present', () => {
    expect(buildClearParkedParams([other])).toEqual([other])
  })
})
