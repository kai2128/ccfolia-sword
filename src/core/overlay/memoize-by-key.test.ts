import { describe, expect, it, vi } from 'vitest'
import { memoizeByKey } from './memoize-by-key'

interface Item {
  id: string
  tag: object
}

describe('memoizeByKey', () => {
  it('builds each item on first pass', () => {
    const cache = new Map()
    const build = vi.fn((i: Item) => ({ id: i.id }))
    const a = { id: 'a', tag: {} }
    const b = { id: 'b', tag: {} }
    const out = memoizeByKey(cache, [a, b], i => i.id, i => [i.tag], build)
    expect(out.map(o => o.id)).toEqual(['a', 'b'])
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('reuses cached value when signature unchanged (same object identity)', () => {
    const cache = new Map()
    const build = vi.fn((i: Item) => ({ id: i.id }))
    const tagA = {}
    const a1 = { id: 'a', tag: tagA }
    const first = memoizeByKey(cache, [a1], i => i.id, i => [i.tag], build)
    const a2 = { id: 'a', tag: tagA } // 新 item 对象,但签名(tag 引用)不变
    const second = memoizeByKey(cache, [a2], i => i.id, i => [i.tag], build)
    expect(build).toHaveBeenCalledTimes(1) // 第二次没重建
    expect(second[0]).toBe(first[0]) // 复用同一输出对象引用
  })

  it('rebuilds when signature changes', () => {
    const cache = new Map()
    const build = vi.fn((i: Item) => ({ id: i.id }))
    const a1 = { id: 'a', tag: {} }
    const first = memoizeByKey(cache, [a1], i => i.id, i => [i.tag], build)
    const a2 = { id: 'a', tag: {} } // 新 tag 引用 → 签名变
    const second = memoizeByKey(cache, [a2], i => i.id, i => [i.tag], build)
    expect(build).toHaveBeenCalledTimes(2)
    expect(second[0]).not.toBe(first[0])
  })

  it('handles variable-length signatures', () => {
    const cache = new Map()
    const build = vi.fn((i: { id: string, xs: number[] }) => ({ id: i.id }))
    const a1 = { id: 'a', xs: [1, 2] }
    memoizeByKey(cache, [a1], i => i.id, i => i.xs, build)
    const a2 = { id: 'a', xs: [1, 2, 3] } // 长度变 → 重建
    memoizeByKey(cache, [a2], i => i.id, i => i.xs, build)
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('prunes cache entries for removed keys', () => {
    const cache = new Map()
    const build = (i: Item) => ({ id: i.id })
    const tag = {}
    memoizeByKey(cache, [{ id: 'a', tag }, { id: 'b', tag }], i => i.id, i => [i.tag], build)
    expect(cache.size).toBe(2)
    memoizeByKey(cache, [{ id: 'a', tag }], i => i.id, i => [i.tag], build)
    expect(cache.size).toBe(1)
    expect(cache.has('b')).toBe(false)
  })
})
