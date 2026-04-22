import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { decodeBuff, encodeBuff } from '@/core/buff/codec'
import { applyBuffSnapshotPatch } from './update-buff-snapshot'

function buildBuff(): BuffInstance {
  return {
    id: 'b1',
    definitionId: 'builtin.poison',
    snapshot: {
      name: '原名',
      icon: 'i-mdi-biohazard',
      description: '原描述',
      modifiers: [{ target: 'defense', value: -1 }],
      tickPrompt: 'tick',
      reminder: 'reminder',
      defaultAoeRadius: 2,
      polarity: 'negative',
    },
    attachedTo: { kind: 'single', characterId: 'c1' },
    lifecycle: 'encounter',
    enabled: true,
    turnsRemaining: 3,
    attachedAtTurn: 1,
  }
}

function pack(buff: BuffInstance): CcfoliaParam[] {
  return [
    { label: 'hp', value: '10' },
    { label: `cs_buff_${buff.id}`, value: encodeBuff(buff) },
    { label: 'mp', value: '5' },
  ]
}

describe('applyBuffSnapshotPatch', () => {
  const n = {
    name: '新名',
    description: '新描述',
    icon: 'i-mdi-fire',
    polarity: 'positive' as const,
    turnsRemaining: 5,
  }

  it('updates snapshot.name / description / icon / polarity', () => {
    const next = applyBuffSnapshotPatch(pack(buildBuff()), 'b1', n)
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_b1')!.value)!
    expect(updated.snapshot.name).toBe('新名')
    expect(updated.snapshot.description).toBe('新描述')
    expect(updated.snapshot.icon).toBe('i-mdi-fire')
    expect(updated.snapshot.polarity).toBe('positive')
  })

  it('updates turnsRemaining and derives lifecycle=encounter', () => {
    const next = applyBuffSnapshotPatch(pack(buildBuff()), 'b1', n)
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_b1')!.value)!
    expect(updated.turnsRemaining).toBe(5)
    expect(updated.lifecycle).toBe('encounter')
  })

  it('derives lifecycle=persistent when turnsRemaining undefined', () => {
    const next = applyBuffSnapshotPatch(pack(buildBuff()), 'b1', { ...n, turnsRemaining: undefined })
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_b1')!.value)!
    expect(updated.turnsRemaining).toBeUndefined()
    expect(updated.lifecycle).toBe('persistent')
  })

  it('preserves modifiers / tickPrompt / reminder / defaultAoeRadius', () => {
    const next = applyBuffSnapshotPatch(pack(buildBuff()), 'b1', n)
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_b1')!.value)!
    expect(updated.snapshot.modifiers).toEqual([{ target: 'defense', value: -1 }])
    expect(updated.snapshot.tickPrompt).toBe('tick')
    expect(updated.snapshot.reminder).toBe('reminder')
    expect(updated.snapshot.defaultAoeRadius).toBe(2)
  })

  it('preserves definitionId / attachedTo / enabled / attachedAtTurn / id', () => {
    const next = applyBuffSnapshotPatch(pack(buildBuff()), 'b1', n)
    const updated = decodeBuff(next.find(p => p.label === 'cs_buff_b1')!.value)!
    expect(updated.id).toBe('b1')
    expect(updated.definitionId).toBe('builtin.poison')
    expect(updated.attachedTo).toEqual({ kind: 'single', characterId: 'c1' })
    expect(updated.enabled).toBe(true)
    expect(updated.attachedAtTurn).toBe(1)
  })

  it('returns same array reference when buff not found', () => {
    const params = pack(buildBuff())
    const next = applyBuffSnapshotPatch(params, 'no-such-id', n)
    expect(next).toBe(params)
  })

  it('keeps non-buff params untouched and in original positions', () => {
    const next = applyBuffSnapshotPatch(pack(buildBuff()), 'b1', n)
    expect(next[0]).toEqual({ label: 'hp', value: '10' })
    expect(next[2]).toEqual({ label: 'mp', value: '5' })
  })
})
