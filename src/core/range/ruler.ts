// 测距工具的纯几何。移动只能横竖(不能斜穿),走位路线走正交 L(先横后竖)。
// direct = 首↔尾切比雪夫(斜角算 1m,射程口径);x+y = 逐段曼哈顿累加(实际移动)。
import type { CellRef } from './types'
import { chebyshev, manhattan } from './distance'

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0)

/**
 * 两个读数:
 * - direct:起点→终点直连(忽略中间点),切比雪夫。
 * - taxi(x+y):沿走位路线逐段曼哈顿累加。
 */
export function pathTotals(points: CellRef[]): { direct: number, taxi: number } {
  if (points.length < 2)
    return { direct: 0, taxi: 0 }
  let taxi = 0
  for (let i = 1; i < points.length; i++)
    taxi += manhattan(points[i - 1], points[i])
  return { direct: chebyshev(points[0], points[points.length - 1]), taxi }
}

/** 单段正交 L(先横后竖)逐格,含两端。 */
export function segmentCells(a: CellRef, b: CellRef): CellRef[] {
  const out: CellRef[] = [{ ...a }]
  let cur: CellRef = { ...a }
  while (cur.col !== b.col) {
    cur = { col: cur.col + sign(b.col - cur.col), row: cur.row }
    out.push(cur)
  }
  while (cur.row !== b.row) {
    cur = { col: cur.col, row: cur.row + sign(b.row - cur.row) }
    out.push(cur)
  }
  return out
}

/** 整条路径拼成正交格序列(去掉衔接处重复端点)。 */
export function orthoRoute(points: CellRef[]): CellRef[] {
  const cells: CellRef[] = []
  for (let i = 1; i < points.length; i++) {
    const seg = segmentCells(points[i - 1], points[i])
    for (let j = i > 1 ? 1 : 0; j < seg.length; j++)
      cells.push(seg[j])
  }
  return cells
}

export interface RulerMarker {
  cell: CellRef
  from: CellRef // 上一个标注点(算单段距离用)
  cumulative: number // 从起点走到这里的累计格数
  segment: number // 上一标注点到这里的单段格数
}

/**
 * 沿正交走位路线的标注点:方向改变处(拐角)或点击落点(中转/终点)。
 * 每步 1m,累计 = 该格在路线里的序号;单段 = 距上一标注点的差。
 */
export function routeMarkers(points: CellRef[]): RulerMarker[] {
  const route = orthoRoute(points)
  const vert = new Set(points.map(p => `${p.col},${p.row}`))
  const dir = (a: CellRef, b: CellRef): string => `${sign(b.col - a.col)},${sign(b.row - a.row)}`
  const out: RulerMarker[] = []
  let prevK = 0
  for (let k = 1; k < route.length; k++) {
    const isTurn = k < route.length - 1 && dir(route[k - 1], route[k]) !== dir(route[k], route[k + 1])
    const isVertex = vert.has(`${route[k].col},${route[k].row}`)
    if (!isTurn && !isVertex)
      continue
    out.push({ cell: route[k], from: route[prevK], cumulative: k, segment: k - prevK })
    prevK = k
  }
  return out
}
