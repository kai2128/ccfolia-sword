import type { CcfoliaCharacter } from '@/types/ccfolia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'

const setSpy = vi.fn()
const commitSpy = vi.fn().mockResolvedValue(undefined)
const docSpy = vi.fn((...args: unknown[]) => ({ __ref: args }))
const writeBatchSpy = vi.fn(() => ({ set: setSpy, commit: commitSpy }))

vi.mock('../firestore-writer', () => ({
  getCurrentRoomId: () => 'room-1',
}))

vi.mock('../webpack-hook', () => ({
  getFirestoreApi: () => ({
    db: {},
    firestore: {
      doc: docSpy,
      writeBatch: writeBatchSpy,
      serverTimestamp: () => ({ __ts: true }),
    },
  }),
}))

const { applyStatusChangesBatch } = await import('./apply-action-batch')

function char(id: string): CcfoliaCharacter {
  return {
    _id: id,
    roomId: 'room-1',
    name: id,
    status: [
      { label: 'HP', value: 25, max: 25 },
      { label: 'MP', value: 12, max: 12 },
    ],
    params: [],
  }
}

beforeEach(() => {
  setSpy.mockClear()
  commitSpy.mockClear()
  docSpy.mockClear()
  writeBatchSpy.mockClear()
})

describe('applyStatusChangesBatch', () => {
  it('merges HP and MP changes for the same character into one set', async () => {
    const c = char('glen')
    await applyStatusChangesBatch(
      [
        { char: c, slot: 'hp', newValue: 18 },
        { char: c, slot: 'mp', newValue: 7 },
      ],
      DEFAULT_STATUS_LABEL_MAP,
    )

    expect(setSpy).toHaveBeenCalledTimes(1)
    const [, payload] = setSpy.mock.calls[0]
    const status = (payload as { status: Array<{ label: string, value: number }> }).status
    expect(status.find(item => item.label === 'HP')?.value).toBe(18)
    expect(status.find(item => item.label === 'MP')?.value).toBe(7)
    expect(commitSpy).toHaveBeenCalledTimes(1)
  })

  it('writes once per character for multiple characters', async () => {
    await applyStatusChangesBatch(
      [
        { char: char('g1'), slot: 'hp', newValue: 5 },
        { char: char('g2'), slot: 'hp', newValue: 8 },
      ],
      DEFAULT_STATUS_LABEL_MAP,
    )

    expect(setSpy).toHaveBeenCalledTimes(2)
  })
})
