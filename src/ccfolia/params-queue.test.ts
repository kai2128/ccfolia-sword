import type { CcfoliaCharacter, CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it, vi } from 'vitest'
import { makeSerializedParamsUpdate } from './params-queue'

function makeStore() {
  const chars = new Map<string, CcfoliaCharacter>([
    ['a', { _id: 'a', roomId: 'r', name: 'A', status: [], params: [] } as CcfoliaCharacter],
    ['b', { _id: 'b', roomId: 'r', name: 'B', status: [], params: [] } as CcfoliaCharacter],
  ])
  let commits = 0

  return {
    get(id: string) {
      return chars.get(id)
    },
    async commit(char: CcfoliaCharacter, next: CcfoliaParam[]) {
      commits += 1
      chars.set(char._id, { ...char, params: next } as CcfoliaCharacter)
    },
    get commits() {
      return commits
    },
  }
}

describe('serializedParamsUpdate', () => {
  it('serializes per-charId: second updater sees first write', async () => {
    const store = makeStore()
    const queue = makeSerializedParamsUpdate({ readChar: store.get, commit: store.commit })

    await Promise.all([
      queue('a', params => [...params, { label: 'x', value: '1' }]),
      queue('a', params => [...params, { label: 'y', value: '2' }]),
    ])

    const finalChar = store.get('a')
    expect(finalChar?.params.map(param => param.label)).toEqual(['x', 'y'])
    expect(store.commits).toBe(2)
  })

  it('runs different charIds in parallel (no cross-charId blocking)', async () => {
    const store = makeStore()
    const order: string[] = []
    const slowCommitOnce = vi.fn(async (char: CcfoliaCharacter, next: CcfoliaParam[]) => {
      if (char._id === 'a')
        await new Promise(resolve => setTimeout(resolve, 20))
      order.push(char._id)
      await store.commit(char, next)
    })
    const queue = makeSerializedParamsUpdate({ readChar: store.get, commit: slowCommitOnce })

    await Promise.all([
      queue('a', params => [...params, { label: 'x', value: '1' }]),
      queue('b', params => [...params, { label: 'x', value: '1' }]),
    ])

    expect(order[0]).toBe('b')
    expect(order[1]).toBe('a')
  })

  it('skips commit when updater returns same reference', async () => {
    const store = makeStore()
    const queue = makeSerializedParamsUpdate({ readChar: store.get, commit: store.commit })

    await queue('a', params => params)
    expect(store.commits).toBe(0)
  })

  it('one updater throwing does not block the next on same charId', async () => {
    const store = makeStore()
    const queue = makeSerializedParamsUpdate({ readChar: store.get, commit: store.commit })

    const first = queue('a', () => {
      throw new Error('boom')
    })
    const second = queue('a', params => [...params, { label: 'after', value: '1' }])

    await expect(first).rejects.toThrow('boom')
    await expect(second).resolves.toBeUndefined()
    expect(store.get('a')?.params.map(param => param.label)).toEqual(['after'])
  })

  it('throws when char missing', async () => {
    const store = makeStore()
    const queue = makeSerializedParamsUpdate({ readChar: store.get, commit: store.commit })

    await expect(queue('ghost', params => params)).rejects.toThrow(/character not found/)
  })
})
