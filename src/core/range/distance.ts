import type { CellRef } from './types'

export function chebyshev(a: CellRef, b: CellRef): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

// 曼哈顿距离:只走横竖的格数(不能斜穿)。
export function manhattan(a: CellRef, b: CellRef): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

export interface Actor<T = string> {
  id: T
  cell: CellRef
}

/**
 * 返回距离中心 ≤ radius 的候选者(含中心自身)。
 * 顺序不保证;调用方如需稳定顺序请自行排序。
 */
export function queryInRange<T>(
  center: CellRef,
  radius: number,
  actors: Actor<T>[],
): Actor<T>[] {
  return actors.filter(a => chebyshev(center, a.cell) <= radius)
}
