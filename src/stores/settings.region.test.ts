import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infra/gm-cross-tab', () => ({ bindGmCrossTabSync: () => {} }))
vi.mock('@/infra/log', () => ({ setRingSize: () => {} }))
vi.mock('@/infra/pinia-persist-adapter', () => ({ createDebouncedGmStorage: () => ({ getItem: () => null, setItem: () => {} }) }))

const { useSettingsStore } = await import('./settings')

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('网格区域限制设置', () => {
  it('默认关闭且隐藏集为空', () => {
    const s = useSettingsStore()
    expect(s.gridRegionRestricted).toBe(false)
    expect(s.gridHiddenCells).toBe('')
  })

  it('setGridRegionRestricted 切换', () => {
    const s = useSettingsStore()
    s.setGridRegionRestricted(true)
    expect(s.gridRegionRestricted).toBe(true)
    s.setGridRegionRestricted(false)
    expect(s.gridRegionRestricted).toBe(false)
  })

  it('setGridHiddenCells 净化:排序 + 去重 + 丢非法', () => {
    const s = useSettingsStore()
    s.setGridHiddenCells('5,10; junk ;0,3;0,3')
    expect(s.gridHiddenCells).toBe('0,3;5,10')
  })

  it('setGridHiddenCells 接受空串(清空)', () => {
    const s = useSettingsStore()
    s.setGridHiddenCells('0,3')
    s.setGridHiddenCells('')
    expect(s.gridHiddenCells).toBe('')
  })
})
