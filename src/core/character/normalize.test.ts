import { describe, expect, it } from 'vitest'
import { makeDragon, makeGoblin, makePc } from '../__fixtures__/characters'
import { denormalizeCharacter, normalizeCharacter } from './normalize'

describe('normalizeCharacter', () => {
  it('单部位 PC:parts 长度 1,isMultiPart=false', () => {
    const rt = normalizeCharacter(makePc())
    expect(rt.parts).toHaveLength(1)
    expect(rt.isMultiPart).toBe(false)
    expect(rt.primaryPartId).toBe(rt.parts[0].id)
  })

  it('单部位 PC:主 part 的 hp/mp/abilities/combat 从平铺字段搬', () => {
    const pc = makePc()
    const rt = normalizeCharacter(pc)
    const main = rt.parts[0]
    expect(main.hp).toEqual(pc.hp)
    expect(main.mp).toEqual(pc.mp)
    expect(main.abilities).toEqual(pc.abilities)
    expect(main.combat).toEqual(pc.combat)
    expect(main.defaultInitiative).toBe(pc.defaultInitiative)
  })

  it('多部位龙:parts 原样搬,isMultiPart=true,primaryPartId 指向 parts[0]', () => {
    const dragon = makeDragon()
    const rt = normalizeCharacter(dragon)
    expect(rt.isMultiPart).toBe(true)
    expect(rt.parts).toHaveLength(3)
    expect(rt.primaryPartId).toBe(dragon.parts![0].id)
    expect(rt.parts[0].name).toBe('本体')
  })

  it('单部位字段全缺时,零值兜底,不抛错', () => {
    const minimal = makePc({
      hp: undefined,
      mp: undefined,
      abilities: undefined,
      combat: undefined,
      defaultInitiative: undefined,
    })
    const rt = normalizeCharacter(minimal)
    expect(rt.parts[0].hp).toEqual({ current: 0, max: 0 })
    expect(rt.parts[0].abilities.dexterity.value).toBe(0)
    expect(rt.parts[0].combat.armor).toBe(0)
  })

  it('primaryPartId 基于 stored.id 稳定(同 id 两次 normalize 结果一致)', () => {
    const pc = makePc()
    const a = normalizeCharacter(pc)
    const b = normalizeCharacter(pc)
    expect(a.primaryPartId).toBe(b.primaryPartId)
  })
})

describe('denormalizeCharacter', () => {
  it('单部位 runtime:写回平铺字段,不写 parts', () => {
    const stored = makeGoblin()
    const rt = normalizeCharacter(stored)
    const back = denormalizeCharacter(rt)
    expect(back.parts).toBeUndefined()
    expect(back.hp).toEqual(stored.hp)
    expect(back.combat).toEqual(stored.combat)
  })

  it('多部位 runtime:写回 parts,不回填平铺字段', () => {
    const stored = makeDragon()
    const rt = normalizeCharacter(stored)
    const back = denormalizeCharacter(rt)
    expect(back.parts).toHaveLength(3)
    expect(back.hp).toBeUndefined()
    expect(back.combat).toBeUndefined()
    expect(back.abilities).toBeUndefined()
  })
})

describe('round-trip 不变式', () => {
  it('单部位 PC:denormalize(normalize(s)) 保结构', () => {
    const stored = makePc()
    const back = denormalizeCharacter(normalizeCharacter(stored))
    expect(back).toEqual(stored)
  })

  it('单部位怪:denormalize(normalize(s)) 保结构', () => {
    const stored = makeGoblin()
    const back = denormalizeCharacter(normalizeCharacter(stored))
    expect(back).toEqual(stored)
  })

  it('多部位龙:denormalize(normalize(s)) 保结构', () => {
    const stored = makeDragon()
    const back = denormalizeCharacter(normalizeCharacter(stored))
    expect(back).toEqual(stored)
  })

  it('normalize(denormalize(rt)) 幂等', () => {
    const rt1 = normalizeCharacter(makePc())
    const rt2 = normalizeCharacter(denormalizeCharacter(rt1))
    expect(rt2).toEqual(rt1)
  })
})
