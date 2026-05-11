import type { CcfoliaCharacter } from '@/types/ccfolia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID_CONFIG } from '@/core/range/types'

const saveSpy = vi.fn().mockResolvedValue(undefined)
const sendSpy = vi.fn().mockResolvedValue(undefined)

vi.mock('./save-character-parked', () => ({
  saveCharacterParked: (id: string, x: number, y: number) => saveSpy(id, x, y),
}))

vi.mock('./send-character-to-parked', () => ({
  sendCharacterToParked: (id: string, opts: { restoreHpMp?: boolean }) => sendSpy(id, opts),
}))

const { useRoomCharactersStore } = await import('@/ccfolia/room-characters-store')
const { applyBatchSavePark, applyBatchSendToPark } = await import('./apply-parked-batch')

// 默认 grid 19×34 @24px,origin (0,0) → 板内格在 (0..456, 0..816) 像素范围。
// onBoard:把 piece (1×1) 放在 (100, 100),脚下落在板内
// offBoard:放在 (-100, -100),脚下落在板外
function char(id: string, x: number, y: number, parked?: { x: number, y: number }): CcfoliaCharacter {
  const params = parked
    ? [{ label: 'cs_park', value: JSON.stringify({ x: parked.x, y: parked.y, savedAt: 0 }) }]
    : []
  return {
    _id: id,
    roomId: 'room-1',
    name: id,
    status: [],
    params,
    x,
    y,
    width: 1,
    height: 1,
  } as unknown as CcfoliaCharacter
}

beforeEach(() => {
  setActivePinia(createPinia())
  saveSpy.mockClear()
  sendSpy.mockClear()
})

describe('applyBatchSavePark', () => {
  it('saves only off-board characters; on-board ones are skipped', async () => {
    const store = useRoomCharactersStore()
    store.replace([
      char('off', -100, -100),
      char('on', 100, 100),
    ])
    const result = await applyBatchSavePark(['off', 'on'], DEFAULT_GRID_CONFIG)
    expect(result).toEqual({ ok: 1, skipped: 1, failures: [] })
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledWith('off', -100, -100)
  })

  it('skips missing characters', async () => {
    const store = useRoomCharactersStore()
    store.replace([char('off', -100, -100)])
    const result = await applyBatchSavePark(['off', 'ghost'], DEFAULT_GRID_CONFIG)
    expect(result).toEqual({ ok: 1, skipped: 1, failures: [] })
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  it('reports failures from saveCharacterParked', async () => {
    const store = useRoomCharactersStore()
    store.replace([char('a', -100, -100), char('b', -200, -200)])
    saveSpy.mockRejectedValueOnce(new Error('boom'))
    const result = await applyBatchSavePark(['a', 'b'], DEFAULT_GRID_CONFIG)
    expect(result.ok).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].charId).toBe('a')
    expect(result.failures[0].error.message).toBe('boom')
  })
})

describe('applyBatchSendToPark', () => {
  it('sends only characters with saved parked location', async () => {
    const store = useRoomCharactersStore()
    store.replace([
      char('has', 100, 100, { x: -50, y: -50 }),
      char('none', 200, 200),
    ])
    const result = await applyBatchSendToPark(['has', 'none'], { restoreHpMp: false })
    expect(result).toEqual({ ok: 1, skipped: 1, failures: [] })
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith('has', { restoreHpMp: false })
  })

  it('passes restoreHpMp opts through', async () => {
    const store = useRoomCharactersStore()
    store.replace([char('a', 100, 100, { x: 0, y: 0 })])
    await applyBatchSendToPark(['a'], { restoreHpMp: true })
    expect(sendSpy).toHaveBeenCalledWith('a', { restoreHpMp: true })
  })

  it('reports failures from sendCharacterToParked', async () => {
    const store = useRoomCharactersStore()
    store.replace([char('a', 100, 100, { x: 0, y: 0 })])
    sendSpy.mockRejectedValueOnce(new Error('nope'))
    const result = await applyBatchSendToPark(['a'], { restoreHpMp: false })
    expect(result.ok).toBe(0)
    expect(result.failures[0].error.message).toBe('nope')
  })

  it('onProgress 先报 (0,total),每个角色 settle 后自增到 (total,total);skipped 不计入 total', async () => {
    const store = useRoomCharactersStore()
    store.replace([
      char('has1', 100, 100, { x: 0, y: 0 }),
      char('has2', 100, 100, { x: 0, y: 0 }),
      char('none', 200, 200), // skipped
    ])
    const onProgress = vi.fn()
    await applyBatchSendToPark(['has1', 'has2', 'none'], { restoreHpMp: false }, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress.mock.calls[0]).toEqual([0, 2])
    expect(onProgress.mock.calls[2]).toEqual([2, 2])
  })
})
