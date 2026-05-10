import { describe, expect, it } from 'vitest'
import { computeCrowded } from './crowd-detect'

const cellSize = 50
const threshold = 3 // 3 cells = 150px

describe('computeCrowded', () => {
  it('少于 2 个棋子永远不拥挤', () => {
    expect(computeCrowded([], cellSize, threshold).size).toBe(0)
    expect(computeCrowded([{ id: 'a', centerX: 0, centerY: 0 }], cellSize, threshold).size).toBe(0)
  })

  it('两个棋子相距 > 阈值 → 都不拥挤', () => {
    const r = computeCrowded([
      { id: 'a', centerX: 0, centerY: 0 },
      { id: 'b', centerX: 200, centerY: 0 },
    ], cellSize, threshold)
    expect(r.size).toBe(0)
  })

  it('两个棋子刚好在阈值内 → 都拥挤', () => {
    const r = computeCrowded([
      { id: 'a', centerX: 0, centerY: 0 },
      { id: 'b', centerX: 100, centerY: 0 },
    ], cellSize, threshold)
    expect(r.has('a')).toBe(true)
    expect(r.has('b')).toBe(true)
  })

  it('对角线距离也算', () => {
    // 距离 = sqrt(80² + 80²) ≈ 113,小于 150 阈值
    const r = computeCrowded([
      { id: 'a', centerX: 0, centerY: 0 },
      { id: 'b', centerX: 80, centerY: 80 },
    ], cellSize, threshold)
    expect(r.size).toBe(2)
  })

  it('三个棋子,只有中间的对两侧都近,但两侧彼此远 → 三个都标拥挤(只要任一邻居近就算)', () => {
    const r = computeCrowded([
      { id: 'left', centerX: 0, centerY: 0 },
      { id: 'mid', centerX: 100, centerY: 0 },
      { id: 'right', centerX: 200, centerY: 0 },
    ], cellSize, threshold)
    expect(r.has('left')).toBe(true)
    expect(r.has('mid')).toBe(true)
    expect(r.has('right')).toBe(true)
  })

  it('孤立棋子不被错标', () => {
    const r = computeCrowded([
      { id: 'a', centerX: 0, centerY: 0 },
      { id: 'b', centerX: 80, centerY: 0 }, // 与 a 拥挤
      { id: 'far', centerX: 1000, centerY: 1000 }, // 远离一切
    ], cellSize, threshold)
    expect(r.has('a')).toBe(true)
    expect(r.has('b')).toBe(true)
    expect(r.has('far')).toBe(false)
  })

  it('cellSize / thresholdCells <= 0 时全不拥挤(防御性)', () => {
    const pieces = [
      { id: 'a', centerX: 0, centerY: 0 },
      { id: 'b', centerX: 1, centerY: 0 },
    ]
    expect(computeCrowded(pieces, 0, 3).size).toBe(0)
    expect(computeCrowded(pieces, 50, 0).size).toBe(0)
    expect(computeCrowded(pieces, -1, 3).size).toBe(0)
  })
})
