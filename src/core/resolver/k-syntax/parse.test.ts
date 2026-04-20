import { describe, expect, it } from 'vitest'
import { parsePowerCommand } from './parse'

describe('parsePowerCommand', () => {
  it('解析最简 k<N>，默认暴击 10、修正 0、非半减', () => {
    const result = parsePowerCommand('k40')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        power: 40,
        critThreshold: 10,
        modifier: 0,
        half: false,
      })
    }
  })

  it('解析正修正 +N', () => {
    const result = parsePowerCommand('k40+3')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.value.modifier).toBe(3)
  })

  it('解析负修正 -N', () => {
    const result = parsePowerCommand('k40-2')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.value.modifier).toBe(-2)
  })

  it('解析 @N 自定义暴击阈值', () => {
    const result = parsePowerCommand('k40@11')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.value.critThreshold).toBe(11)
  })

  it('解析 kh<N> 半减，默认暴击阈值 13', () => {
    const result = parsePowerCommand('kh30')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        power: 30,
        critThreshold: 13,
        modifier: 0,
        half: true,
      })
    }
  })

  it('解析 k<N>h 半减后缀', () => {
    const result = parsePowerCommand('k30h')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        power: 30,
        critThreshold: 13,
        modifier: 0,
        half: true,
      })
    }
  })

  it('解析 h 附带修正', () => {
    const result = parsePowerCommand('kh30+2')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        power: 30,
        critThreshold: 13,
        modifier: 2,
        half: true,
      })
    }
  })

  it('组合 k<N>+<M>@<C>', () => {
    const result = parsePowerCommand('k40+3@11')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        power: 40,
        critThreshold: 11,
        modifier: 3,
        half: false,
      })
    }
  })

  it('组合顺序可互换 k<N>@<C>+<M>', () => {
    const result = parsePowerCommand('k40@11+3')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        power: 40,
        critThreshold: 11,
        modifier: 3,
        half: false,
      })
    }
  })

  it('h 显式覆盖暴击阈值', () => {
    const result = parsePowerCommand('kh30@12')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.value.critThreshold).toBe(12)
  })

  it('非法：双 k 前缀', () => {
    expect(parsePowerCommand('kk40').ok).toBe(false)
  })

  it('非法：缺威力值', () => {
    expect(parsePowerCommand('k').ok).toBe(false)
  })

  it('非法：没有 k 前缀', () => {
    expect(parsePowerCommand('40').ok).toBe(false)
  })

  it('非法：@ 后无数字', () => {
    expect(parsePowerCommand('k40@').ok).toBe(false)
  })

  it('非法：+ 后无数字', () => {
    expect(parsePowerCommand('k40+').ok).toBe(false)
  })

  it('非法：h 修正与独立修正重复', () => {
    expect(parsePowerCommand('k40+2h+1').ok).toBe(false)
  })

  it('非法：空字符串', () => {
    expect(parsePowerCommand('').ok).toBe(false)
  })

  it('非法：尾部垃圾字符', () => {
    expect(parsePowerCommand('k40xyz').ok).toBe(false)
  })
})
