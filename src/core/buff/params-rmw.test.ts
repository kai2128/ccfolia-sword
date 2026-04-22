import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { encodeBuff } from './codec'
import { appendBuff, applyBuffOps, removeBuff, updateBuff } from './params-rmw'

function makeBuff(id: string, patch: Partial<BuffInstance> = {}): BuffInstance {
  return {
    id,
    definitionId: 'builtin.poison',
    snapshot: { name: 'x', icon: '', description: '', modifiers: [], polarity: 'positive' },
    attachedTo: { kind: 'single', characterId: 'c1' },
    lifecycle: 'encounter',
    enabled: true,
    attachedAtTurn: 1,
    ...patch,
  }
}

function makeBuffParam(buff: BuffInstance): CcfoliaParam {
  return { label: `cs_buff_${buff.id}`, value: encodeBuff(buff) }
}

describe('applyBuffOps', () => {
  const nonBuff: CcfoliaParam[] = [
    { label: 'cs_part_leg', value: '健康' },
    { label: 'note', value: '自由填写' },
  ]

  it('append adds new cs_buff entry and preserves non-buff params', () => {
    const buff = makeBuff('new-1')
    const next = applyBuffOps([...nonBuff], [appendBuff(buff)])
    expect(next).toHaveLength(3)
    expect(next.filter(param => param.label === 'cs_part_leg')).toHaveLength(1)
    expect(next.find(param => param.label === 'cs_buff_new-1')?.value).toBe(encodeBuff(buff))
  })

  it('remove drops only the matching cs_buff entry', () => {
    const first = makeBuff('b-1')
    const second = makeBuff('b-2')
    const input: CcfoliaParam[] = [...nonBuff, makeBuffParam(first), makeBuffParam(second)]
    const next = applyBuffOps(input, [removeBuff('b-1')])
    expect(next.find(param => param.label === 'cs_buff_b-1')).toBeUndefined()
    expect(next.find(param => param.label === 'cs_buff_b-2')).toBeDefined()
    expect(next.filter(param => param.label === 'cs_part_leg')).toHaveLength(1)
  })

  it('update replaces value of an existing cs_buff entry', () => {
    const buff = makeBuff('b-1', { enabled: true })
    const disabled = { ...buff, enabled: false }
    const next = applyBuffOps([makeBuffParam(buff)], [updateBuff(disabled)])
    expect(next.find(param => param.label === 'cs_buff_b-1')?.value).toBe(encodeBuff(disabled))
  })

  it('update of missing buff is a no-op', () => {
    const next = applyBuffOps([...nonBuff], [updateBuff(makeBuff('ghost'))])
    expect(next.find(param => param.label === 'cs_buff_ghost')).toBeUndefined()
    expect(next).toEqual(nonBuff)
  })

  it('append of duplicate id overwrites existing entry', () => {
    const oldBuff = makeBuff('dup', { note: 'old' })
    const newBuff = makeBuff('dup', { note: 'new' })
    const next = applyBuffOps([makeBuffParam(oldBuff)], [appendBuff(newBuff)])
    expect(next).toHaveLength(1)
    expect(next[0].value).toBe(encodeBuff(newBuff))
  })

  it('batch ops apply in order', () => {
    const first = makeBuff('b-1')
    const second = makeBuff('b-2')
    const next = applyBuffOps([], [appendBuff(first), appendBuff(second), removeBuff('b-1')])
    expect(next).toHaveLength(1)
    expect(next[0].label).toBe('cs_buff_b-2')
  })

  it('does not mutate input array', () => {
    const input: CcfoliaParam[] = [...nonBuff]
    applyBuffOps(input, [appendBuff(makeBuff('x'))])
    expect(input).toHaveLength(2)
  })
})
