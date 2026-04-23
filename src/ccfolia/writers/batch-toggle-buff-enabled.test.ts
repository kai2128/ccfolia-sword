import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { decodeBuff, encodeBuff } from '@/core/buff/codec'
import { applyDeathRevivalToBuffs } from './batch-toggle-buff-enabled'

function buff(id: string, enabled: boolean, disabledByDeath?: boolean): BuffInstance {
  return {
    id,
    definitionId: 'd',
    snapshot: { name: id, icon: '', description: '', modifiers: [], polarity: 'positive' },
    attachedTo: { kind: 'single', characterId: 'c1' },
    lifecycle: 'encounter',
    enabled,
    attachedAtTurn: 1,
    ...(disabledByDeath ? { disabledByDeath: true } : {}),
  }
}

function pack(buffs: BuffInstance[]): CcfoliaParam[] {
  return [
    { label: 'hp', value: '10' },
    ...buffs.map(b => ({ label: `cs_buff_${b.id}`, value: encodeBuff(b) })),
  ]
}

function readBuff(params: CcfoliaParam[], id: string): BuffInstance {
  const entry = params.find(p => p.label === `cs_buff_${id}`)!
  return decodeBuff(entry.value)!
}

describe('applyDeathRevivalToBuffs', () => {
  it('death disables all enabled buffs and tags them with disabledByDeath', () => {
    const next = applyDeathRevivalToBuffs(pack([buff('a', true), buff('b', true)]), false)
    const a = readBuff(next, 'a')
    const b = readBuff(next, 'b')
    expect(a.enabled).toBe(false)
    expect(a.disabledByDeath).toBe(true)
    expect(b.enabled).toBe(false)
    expect(b.disabledByDeath).toBe(true)
  })

  it('death leaves manually-disabled buffs untouched (no tag)', () => {
    const next = applyDeathRevivalToBuffs(pack([buff('c', false)]), false)
    const c = readBuff(next, 'c')
    expect(c.enabled).toBe(false)
    expect(c.disabledByDeath).toBeUndefined()
  })

  it('revive re-enables ONLY disabledByDeath buffs and clears the tag', () => {
    // 场景:a 是死亡自动禁用,c 是 GM 死前手动禁用
    const params = pack([buff('a', false, true), buff('c', false)])
    const next = applyDeathRevivalToBuffs(params, true)
    const a = readBuff(next, 'a')
    const c = readBuff(next, 'c')
    expect(a.enabled).toBe(true)
    expect(a.disabledByDeath).toBeUndefined()
    // c 没有标记,复活时应保持 GM 的禁用意图
    expect(c.enabled).toBe(false)
  })

  it('revive is idempotent — enabled buffs without tag are untouched', () => {
    const params = pack([buff('e', true)])
    const next = applyDeathRevivalToBuffs(params, true)
    // 数组引用可能换,但 buff 内容应相等
    expect(readBuff(next, 'e').enabled).toBe(true)
  })

  it('leaves non-buff params alone', () => {
    const params = pack([buff('a', true)])
    const next = applyDeathRevivalToBuffs(params, false)
    expect(next.find(p => p.label === 'hp')?.value).toBe('10')
  })
})
