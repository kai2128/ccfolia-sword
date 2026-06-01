import { describe, expect, it } from 'vitest'
import { AOE_PRESETS } from './aoe-preset'

describe('aOE_PRESETS', () => {
  it('含 领域抗性 5m 橙', () => {
    const p = AOE_PRESETS.find(x => x.key === 'resist')!
    expect(p).toBeDefined()
    expect(p.label).toBe('领域抗性')
    expect(p.radiusM).toBe(5)
    expect(p.color).toBe('#cf8533')
  })

  it('含 防护领域 3m 金', () => {
    const p = AOE_PRESETS.find(x => x.key === 'ward')!
    expect(p).toBeDefined()
    expect(p.label).toBe('防护领域')
    expect(p.radiusM).toBe(3)
    expect(p.color).toBe('#e7c66a')
  })

  it('key 唯一', () => {
    const keys = AOE_PRESETS.map(p => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
