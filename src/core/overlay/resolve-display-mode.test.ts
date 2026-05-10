import { describe, expect, it } from 'vitest'
import { resolveDisplayMode } from './resolve-display-mode'

describe('resolveDisplayMode', () => {
  it('override 强制 C,无视任何其它输入', () => {
    expect(resolveDisplayMode({ isMultipart: true, override: 'C', isCrowded: true, autoSwitchOnCrowded: true })).toBe('C')
    expect(resolveDisplayMode({ isMultipart: false, override: 'C', isCrowded: false, autoSwitchOnCrowded: false })).toBe('C')
  })

  it('override 强制 E,无视任何其它输入', () => {
    expect(resolveDisplayMode({ isMultipart: true, override: 'E', isCrowded: false, autoSwitchOnCrowded: false })).toBe('E')
    expect(resolveDisplayMode({ isMultipart: false, override: 'E', isCrowded: false, autoSwitchOnCrowded: true })).toBe('E')
  })

  it('auto + 多部位 → E', () => {
    expect(resolveDisplayMode({ isMultipart: true, override: 'auto', isCrowded: false, autoSwitchOnCrowded: true })).toBe('E')
    expect(resolveDisplayMode({ isMultipart: true, override: 'auto', isCrowded: true, autoSwitchOnCrowded: false })).toBe('E')
  })

  it('auto + 单部位 + 不拥挤 → C', () => {
    expect(resolveDisplayMode({ isMultipart: false, override: 'auto', isCrowded: false, autoSwitchOnCrowded: true })).toBe('C')
  })

  it('auto + 单部位 + 拥挤 + 自动开 → E', () => {
    expect(resolveDisplayMode({ isMultipart: false, override: 'auto', isCrowded: true, autoSwitchOnCrowded: true })).toBe('E')
  })

  it('auto + 单部位 + 拥挤 + 自动关 → C(用户全局关掉了自动)', () => {
    expect(resolveDisplayMode({ isMultipart: false, override: 'auto', isCrowded: true, autoSwitchOnCrowded: false })).toBe('C')
  })
})
