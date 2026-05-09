import type { CcfoliaCharacter } from '@/types/ccfolia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STATUS_LABEL_MAP } from '@/core/status-slot'

const patchStatusSpy = vi.fn().mockResolvedValue(undefined)

vi.mock('../firestore-writer', () => ({
  getCurrentRoomId: () => 'room-1',
  patchStatus: patchStatusSpy,
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
  setActivePinia(createPinia())
  patchStatusSpy.mockClear()
})

describe('applyStatusChangesBatch', () => {
  it('merges HP and MP changes for the same character into one patchStatus call', async () => {
    const c = char('glen')
    await applyStatusChangesBatch(
      [
        { char: c, slot: 'hp', newValue: 18 },
        { char: c, slot: 'mp', newValue: 7 },
      ],
      DEFAULT_STATUS_LABEL_MAP,
    )

    expect(patchStatusSpy).toHaveBeenCalledTimes(1)
    const [arg] = patchStatusSpy.mock.calls[0]
    const status = (arg as { newStatus: Array<{ label: string, value: number }> }).newStatus
    expect(status.find(item => item.label === 'HP')?.value).toBe(18)
    expect(status.find(item => item.label === 'MP')?.value).toBe(7)
  })

  it('writes once per character for multiple characters (parallel patchStatus)', async () => {
    await applyStatusChangesBatch(
      [
        { char: char('g1'), slot: 'hp', newValue: 5 },
        { char: char('g2'), slot: 'hp', newValue: 8 },
      ],
      DEFAULT_STATUS_LABEL_MAP,
    )

    expect(patchStatusSpy).toHaveBeenCalledTimes(2)
  })
})
