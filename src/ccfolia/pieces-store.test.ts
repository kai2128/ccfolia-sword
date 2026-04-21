import type { CcfoliaCharacter } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { toPieceSnapshots } from './pieces-store'

function mkChar(overrides: Partial<CcfoliaCharacter> & { _id: string }): CcfoliaCharacter {
  return {
    roomId: 'r',
    name: overrides.name ?? overrides._id,
    status: [],
    params: [],
    ...overrides,
  }
}

describe('toPieceSnapshots', () => {
  it('maps characters with x/y into PieceSnapshot[]', () => {
    const chars = [
      mkChar({ _id: 'c1', x: 100, y: 200, width: 2, height: 2, z: 1, angle: 0, invisible: false, hideStatus: false }),
      mkChar({ _id: 'c2', x: 300, y: 400, width: 1, height: 1 }),
    ]
    const res = toPieceSnapshots(chars)
    expect(res).toHaveLength(2)
    expect(res[0]).toMatchObject({
      characterId: 'c1',
      x: 100,
      y: 200,
      widthCells: 2,
      heightCells: 2,
      z: 1,
      invisible: false,
      hideStatus: false,
    })
  })

  it('skips characters without numeric x or y', () => {
    const chars = [
      mkChar({ _id: 'c1', x: 100, y: 200 }),
      mkChar({ _id: 'c2' }), // no position
      mkChar({ _id: 'c3', x: 'nope' as unknown as number, y: 1 }),
    ]
    expect(toPieceSnapshots(chars).map(p => p.characterId)).toEqual(['c1'])
  })

  it('defaults optional fields safely', () => {
    const chars = [mkChar({ _id: 'c1', x: 0, y: 0 })]
    const p = toPieceSnapshots(chars)[0]
    expect(p.widthCells).toBe(1)
    expect(p.heightCells).toBe(1)
    expect(p.z).toBe(0)
    expect(p.angle).toBe(0)
    expect(p.invisible).toBe(false)
    expect(p.hideStatus).toBe(false)
  })
})
