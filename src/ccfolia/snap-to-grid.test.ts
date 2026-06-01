import type { GridConfig } from '@/core/range/types'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { describe, expect, it } from 'vitest'
import { collectSnaps } from './snap-to-grid'

const GRID: GridConfig = {
  cols: 19,
  rows: 34,
  gridSize: 1,
  cellSizePx: 24,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'top-left',
}

function char(id: string, x: number, y: number): CcfoliaCharacter {
  return { _id: id, roomId: 'r', name: id, status: [], params: [], x, y, width: 1, height: 1 } as unknown as CcfoliaCharacter
}

type PosMap = Map<string, { x: number, y: number }>

describe('collectSnaps', () => {
  it('批量:每个选中且移动的角色各产出一个落点,prevPos 记成落点', () => {
    const chars = [char('a', 70, 95), char('b', 30, 50), char('c', 100, 120)]
    const prev: PosMap = new Map()
    const out = collectSnaps(chars, prev, { enabled: true, selected: new Set(['a', 'b', 'c']), grid: GRID })
    expect(out).toHaveLength(3)
    for (const { char: c, target } of out)
      expect(prev.get(c._id)).toEqual(target)
  })

  it('落点回流不再重复处理(自己的写入回来不会被当成新移动)', () => {
    const prev: PosMap = new Map()
    const first = collectSnaps([char('a', 70, 95)], prev, { enabled: true, selected: new Set(['a']), grid: GRID })
    expect(first).toHaveLength(1)
    const t = first[0].target
    // 模拟我们的写入回流:角色现在就在落点上
    const second = collectSnaps([char('a', t.x, t.y)], prev, { enabled: true, selected: new Set(['a']), grid: GRID })
    expect(second).toHaveLength(0)
  })

  it('关闭吸附 → 不产出', () => {
    expect(collectSnaps([char('a', 70, 95)], new Map(), { enabled: false, selected: new Set(['a']), grid: GRID })).toHaveLength(0)
  })

  it('未选中 → 不产出', () => {
    expect(collectSnaps([char('a', 70, 95)], new Map(), { enabled: true, selected: new Set(['z']), grid: GRID })).toHaveLength(0)
  })

  it('未移动(prev 等于当前坐标) → 不产出', () => {
    const prev: PosMap = new Map([['a', { x: 70, y: 95 }]])
    expect(collectSnaps([char('a', 70, 95)], prev, { enabled: true, selected: new Set(['a']), grid: GRID })).toHaveLength(0)
  })
})
