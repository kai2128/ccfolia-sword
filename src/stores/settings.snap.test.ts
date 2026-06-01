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
  it('默认关闭', () => {
    expect(useSettingsStore().snapToGrid).toBe(false)
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
