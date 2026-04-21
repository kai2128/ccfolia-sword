import { beforeEach, describe, expect, it } from 'vitest'
import { readSharedValue, writeSharedValue } from './gm-values'

beforeEach(() => {
  const store: Record<string, unknown> = {}
  ;(globalThis as { GM_setValue?: (key: string, value: unknown) => void }).GM_setValue = (key, value) => {
    store[key] = value
  }
  ;(globalThis as { GM_getValue?: <T>(key: string, defaultValue?: T) => T }).GM_getValue = (key, defaultValue) => {
    return (store[key] ?? defaultValue) as typeof defaultValue
  }
})

describe('gm-values', () => {
  it('writes JSON encoded value', () => {
    writeSharedValue('ccs:x', { n: 1 })
    expect((globalThis as { GM_getValue: (key: string) => unknown }).GM_getValue('ccs:x')).toBe(JSON.stringify({ n: 1 }))
  })

  it('reads JSON decoded value', () => {
    writeSharedValue('ccs:x', { n: 2 })
    expect(readSharedValue<{ n: number }>('ccs:x', { n: 0 })).toEqual({ n: 2 })
  })

  it('returns default when key is missing', () => {
    expect(readSharedValue<{ n: number }>('ccs:missing', { n: 42 })).toEqual({ n: 42 })
  })

  it('returns default on malformed JSON', () => {
    ;(globalThis as { GM_setValue: (key: string, value: unknown) => void }).GM_setValue('ccs:bad', 'not json {{')
    expect(readSharedValue<{ n: number }>('ccs:bad', { n: 7 })).toEqual({ n: 7 })
  })
})
