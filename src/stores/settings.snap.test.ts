import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// settings.ts 依赖一批 infra,这里全部 stub 掉,只测纯状态逻辑。
vi.mock('@/infra/gm-cross-tab', () => ({ bindGmCrossTabSync: () => {} }))
vi.mock('@/infra/log', () => ({ setRingSize: () => {} }))
vi.mock('@/infra/pinia-persist-adapter', () => ({ createDebouncedGmStorage: () => ({ getItem: () => null, setItem: () => {} }) }))

const { useSettingsStore } = await import('./settings')

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('snapToGrid 设置', () => {
  it('默认开启', () => {
    expect(useSettingsStore().snapToGrid).toBe(true)
  })

  it('与网格可见性互不联动:改可见性不动吸附', () => {
    const s = useSettingsStore()
    s.setSnapToGrid(true)
    s.setGridOverlayVisible(false)
    expect(s.snapToGrid).toBe(true)
    s.setGridOverlayVisible(true)
    expect(s.snapToGrid).toBe(true)
  })

  it('与网格可见性互不联动:改吸附不动可见性', () => {
    const s = useSettingsStore()
    s.setGridOverlayVisible(true)
    s.setSnapToGrid(false)
    expect(s.gridOverlayVisible).toBe(true)
    s.setSnapToGrid(true)
    expect(s.gridOverlayVisible).toBe(true)
  })
})

describe('hpmpIndicatorScale 设置', () => {
  it('默认 1', () => {
    expect(useSettingsStore().hpmpIndicatorScale).toBe(1)
  })

  it('越界 / 脏值夹到 [0.6, 3],NaN 回落 1', () => {
    const s = useSettingsStore()
    s.setHpmpIndicatorScale(5)
    expect(s.hpmpIndicatorScale).toBe(3)
    s.setHpmpIndicatorScale(0.1)
    expect(s.hpmpIndicatorScale).toBe(0.6)
    s.setHpmpIndicatorScale(Number.NaN)
    expect(s.hpmpIndicatorScale).toBe(1)
    s.setHpmpIndicatorScale(1.3)
    expect(s.hpmpIndicatorScale).toBe(1.3)
  })
})
