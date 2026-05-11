import type { CcfoliaCharacter, CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { readParkedLocation } from './read'

function ch(params: CcfoliaParam[]): CcfoliaCharacter {
  return { _id: 'x', roomId: 'r', name: 'X', status: [], params } as CcfoliaCharacter
}

describe('readParkedLocation', () => {
  it('returns null when no cs_park entry', () => {
    expect(readParkedLocation(ch([{ label: 'cs_tag_a', value: '{}' }]))).toBeNull()
  })

  it('parses cs_park entry into {x, y, savedAt}', () => {
    expect(readParkedLocation(ch([
      { label: 'cs_park', value: '{"x":100,"y":200,"savedAt":1234}' },
    ]))).toEqual({ x: 100, y: 200, savedAt: 1234 })
  })

  it('returns null on invalid JSON', () => {
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{not json' }]))).toBeNull()
  })

  it('returns null when payload is not an object', () => {
    expect(readParkedLocation(ch([{ label: 'cs_park', value: 'null' }]))).toBeNull()
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '"hi"' }]))).toBeNull()
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '42' }]))).toBeNull()
  })

  it('returns null when x or y is missing / not finite / not a number', () => {
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{"y":1}' }]))).toBeNull()
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{"x":"a","y":1}' }]))).toBeNull()
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{"x":1,"y":null}' }]))).toBeNull()
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{"x":1}' }]))).toBeNull()
  })

  it('defaults savedAt to 0 when missing or not a number', () => {
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{"x":1,"y":2}' }])))
      .toEqual({ x: 1, y: 2, savedAt: 0 })
    expect(readParkedLocation(ch([{ label: 'cs_park', value: '{"x":1,"y":2,"savedAt":"nope"}' }])))
      .toEqual({ x: 1, y: 2, savedAt: 0 })
  })
})
