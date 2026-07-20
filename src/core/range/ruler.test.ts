import type { CellRef } from './types'
import { describe, expect, it } from 'vitest'
import { orthoRoute, pathTotals, routeMarkers, segmentCells } from './ruler'

const c = (col: number, row: number): CellRef => ({ col, row })

describe('pathTotals', () => {
  it('少于两点返回 0', () => {
    expect(pathTotals([])).toEqual({ direct: 0, taxi: 0 })
    expect(pathTotals([c(1, 1)])).toEqual({ direct: 0, taxi: 0 })
  })

  it('两点:direct = 切比雪夫,taxi = 曼哈顿', () => {
    expect(pathTotals([c(0, 0), c(3, 2)])).toEqual({ direct: 3, taxi: 5 })
  })

  it('多点:direct 只量首↔尾(忽略中间),taxi 逐段累加', () => {
    // 0→6→9:x+y 逐段 = 6 + 3 = 9;direct = 首尾切比雪夫
    const pts = [c(0, 0), c(6, 0), c(6, 3)]
    expect(pathTotals(pts).taxi).toBe(9)
    expect(pathTotals(pts).direct).toBe(chebyshevRef(c(0, 0), c(6, 3)))
  })
})

function chebyshevRef(a: CellRef, b: CellRef): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

describe('segmentCells', () => {
  it('先横后竖,含两端,长度 = 曼哈顿 + 1', () => {
    const cells = segmentCells(c(0, 0), c(2, 1))
    expect(cells).toEqual([c(0, 0), c(1, 0), c(2, 0), c(2, 1)])
  })

  it('纯横向', () => {
    expect(segmentCells(c(0, 0), c(3, 0))).toEqual([c(0, 0), c(1, 0), c(2, 0), c(3, 0)])
  })

  it('同格返回单格', () => {
    expect(segmentCells(c(2, 2), c(2, 2))).toEqual([c(2, 2)])
  })
})

describe('orthoRoute', () => {
  it('多段拼接去掉衔接处重复端点', () => {
    // (0,0)→(2,0)→(2,2):第二段起点 (2,0) 与第一段终点重复,应只出现一次
    const route = orthoRoute([c(0, 0), c(2, 0), c(2, 2)])
    expect(route).toEqual([c(0, 0), c(1, 0), c(2, 0), c(2, 1), c(2, 2)])
  })
})

describe('routeMarkers', () => {
  it('拐角与终点都标,累计与单段正确', () => {
    // (0,0)→(3,2):先横 3 到 (3,0) 拐弯,再竖 2 到 (3,2)
    const m = routeMarkers([c(0, 0), c(3, 2)])
    // 拐角 (3,0):累计 3,单段 3;终点 (3,2):累计 5,单段 2
    expect(m).toEqual([
      { cell: c(3, 0), from: c(0, 0), cumulative: 3, segment: 3 },
      { cell: c(3, 2), from: c(3, 0), cumulative: 5, segment: 2 },
    ])
  })

  it('多点:中转点也是标注点', () => {
    // 0→6→9 的例子:标注点在累计 6(中转)与 9(终点),单段 6 与 3
    const m = routeMarkers([c(0, 0), c(6, 0), c(6, 3)])
    expect(m.map(x => [x.cumulative, x.segment])).toEqual([[6, 6], [9, 3]])
  })

  it('纯直线无拐角,只在终点标', () => {
    const m = routeMarkers([c(0, 0), c(4, 0)])
    expect(m).toEqual([{ cell: c(4, 0), from: c(0, 0), cumulative: 4, segment: 4 }])
  })
})
