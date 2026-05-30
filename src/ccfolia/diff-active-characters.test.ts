import type { CcfoliaCharacter } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { diffActiveCharacters } from './diff-active-characters'

function makeChar(id: string): CcfoliaCharacter {
  return { _id: id, name: id, status: [] } as unknown as CcfoliaCharacter
}

describe('diffActiveCharacters', () => {
  it('detects a changed entity by reference', () => {
    const a1 = makeChar('a')
    const b = makeChar('b')
    const prev = new Map([['a', a1], ['b', b]])
    const a2 = makeChar('a') // 新引用 = 变了
    const next = [a2, b] // b 同引用 = 没变
    const diff = diffActiveCharacters(prev, next)
    expect(diff.changedIds).toEqual(['a'])
    expect(diff.removedIds).toEqual([])
    expect(diff.membershipChanged).toBe(false)
  })

  it('treats brand-new ids as changed + membershipChanged', () => {
    const a = makeChar('a')
    const prev = new Map([['a', a]])
    const c = makeChar('c')
    const diff = diffActiveCharacters(prev, [a, c])
    expect(diff.changedIds).toEqual(['c'])
    expect(diff.membershipChanged).toBe(true)
  })

  it('reports removed ids and membershipChanged', () => {
    const a = makeChar('a')
    const b = makeChar('b')
    const prev = new Map([['a', a], ['b', b]])
    const diff = diffActiveCharacters(prev, [a])
    expect(diff.changedIds).toEqual([])
    expect(diff.removedIds).toEqual(['b'])
    expect(diff.membershipChanged).toBe(true)
  })

  it('returns empty diff when nothing changed', () => {
    const a = makeChar('a')
    const b = makeChar('b')
    const prev = new Map([['a', a], ['b', b]])
    const diff = diffActiveCharacters(prev, [a, b])
    expect(diff.changedIds).toEqual([])
    expect(diff.removedIds).toEqual([])
    expect(diff.membershipChanged).toBe(false)
  })
})
