import { describe, expect, it } from 'vitest'
import { extractRoomCharacters } from './room-characters-store'

describe('extractRoomCharacters', () => {
  it('materializes active characters in ids order', () => {
    const state = {
      entities: {
        roomCharacters: {
          ids: ['c1', 'c2', 'c3'],
          entities: {
            c1: { _id: 'c1', name: 'A', active: true },
            c2: { _id: 'c2', name: 'B', active: false },
            c3: { _id: 'c3', name: 'C', active: true },
          },
        },
      },
    }
    const res = extractRoomCharacters(state)
    expect(res.map(c => c._id)).toEqual(['c1', 'c3'])
  })

  it('returns empty for missing slice', () => {
    expect(extractRoomCharacters({})).toEqual([])
    expect(extractRoomCharacters({ entities: {} })).toEqual([])
    expect(extractRoomCharacters({ entities: { roomCharacters: undefined } })).toEqual([])
  })
})
