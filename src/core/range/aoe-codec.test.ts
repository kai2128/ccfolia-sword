import type { StoredAoe } from './aoe-indicator'
import { describe, expect, it } from 'vitest'
import {
  aoeLabel,
  applyAoeOps,
  applyAoeTickToParams,
  decodeAoe,
  encodeAoe,
  isAoeLabel,
  removeAoe,
  setAoe,
} from './aoe-codec'

function make(id: string, turnsRemaining: number | null = null): StoredAoe {
  return { id, label: '领域', radiusM: 3, color: '#cf8533', turnsRemaining, enabled: true }
}

describe('aoe codec', () => {
  it('label 前缀识别', () => {
    expect(aoeLabel('x')).toBe('cs_aoe_x')
    expect(isAoeLabel('cs_aoe_x')).toBe(true)
    expect(isAoeLabel('cs_buff_x')).toBe(false)
  })

  it('encode / decode 往返', () => {
    const a = make('a', 5)
    expect(decodeAoe(encodeAoe(a))).toEqual(a)
  })

  it('decode 非法返回 null', () => {
    expect(decodeAoe('not json')).toBeNull()
    expect(decodeAoe(JSON.stringify({ id: 'a' }))).toBeNull()
    expect(decodeAoe(JSON.stringify({ id: 'a', label: 'L', radiusM: 'x', color: '#fff', turnsRemaining: null }))).toBeNull()
  })

  it('turnsRemaining null 合法、字符串非法', () => {
    expect(decodeAoe(encodeAoe(make('a', null)))).not.toBeNull()
    expect(decodeAoe(JSON.stringify({ ...make('a'), turnsRemaining: 'x' }))).toBeNull()
  })

  it('缺 enabled 字段 → 默认 true(旧数据兼容)', () => {
    const { enabled: _e, ...noEnabled } = make('a')
    expect(decodeAoe(JSON.stringify(noEnabled))!.enabled).toBe(true)
  })
})

describe('applyAoeOps', () => {
  it('set 新增', () => {
    const out = applyAoeOps([], [setAoe(make('a'))])
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('cs_aoe_a')
  })

  it('set 同 id upsert(就地替换,不新增)', () => {
    const p1 = applyAoeOps([], [setAoe(make('a', 3))])
    const p2 = applyAoeOps(p1, [setAoe(make('a', 9))])
    expect(p2).toHaveLength(1)
    expect(decodeAoe(p2[0].value)!.turnsRemaining).toBe(9)
  })

  it('remove 删除', () => {
    const p1 = applyAoeOps([], [setAoe(make('a'))])
    expect(applyAoeOps(p1, [removeAoe('a')])).toHaveLength(0)
  })

  it('保留非 AOE 条目', () => {
    const params = [{ label: 'cs_buff_x', value: '{}' }]
    const out = applyAoeOps(params, [setAoe(make('a'))])
    expect(out.some(p => p.label === 'cs_buff_x')).toBe(true)
    expect(out).toHaveLength(2)
  })
})

describe('applyAoeTickToParams', () => {
  it('number -1', () => {
    const params = applyAoeOps([], [setAoe(make('a', 3))])
    const out = applyAoeTickToParams(params)
    expect(decodeAoe(out[0].value)!.turnsRemaining).toBe(2)
  })

  it('到 1 → tick 后移除', () => {
    const params = applyAoeOps([], [setAoe(make('a', 1))])
    expect(applyAoeTickToParams(params)).toHaveLength(0)
  })

  it('null 永久保留不变', () => {
    const params = applyAoeOps([], [setAoe(make('a', null))])
    const out = applyAoeTickToParams(params)
    expect(out).toHaveLength(1)
    expect(decodeAoe(out[0].value)!.turnsRemaining).toBeNull()
  })

  it('非 AOE 条目不动,无变化返回原引用', () => {
    const params = [{ label: 'cs_buff_x', value: '{}' }]
    expect(applyAoeTickToParams(params)).toBe(params)
  })

  it('混合:永久留、衰减、剔除', () => {
    let params = applyAoeOps([], [setAoe(make('keep', null))])
    params = applyAoeOps(params, [setAoe(make('dec', 2))])
    params = applyAoeOps(params, [setAoe(make('gone', 1))])
    const out = applyAoeTickToParams(params)
    const ids = out.map(p => decodeAoe(p.value)!.id)
    expect(ids).toEqual(['keep', 'dec'])
  })
})
