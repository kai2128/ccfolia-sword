import { describe, expect, it } from 'vitest'
import { formatActorRef, parseActorRef } from './actor-ref'

describe('actor-ref', () => {
  it('format/parse 往返:单部位', () => {
    const ref = formatActorRef('c1', '')
    expect(ref).toBe('c1::')
    expect(parseActorRef(ref)).toEqual({ charId: 'c1', partKey: '' })
  })

  it('format/parse 往返:多部位', () => {
    const ref = formatActorRef('c1', 'X1')
    expect(ref).toBe('c1::X1')
    expect(parseActorRef(ref)).toEqual({ charId: 'c1', partKey: 'X1' })
  })

  it('parse 兼容裸 charId(老格式)', () => {
    expect(parseActorRef('c1')).toEqual({ charId: 'c1', partKey: '' })
  })
})
