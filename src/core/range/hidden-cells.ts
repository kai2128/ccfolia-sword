import type { CellRef } from './types'

// 网格隐藏格集合的 key 与序列化。key 统一 "col,row",显式坐标(非 bitmask),
// 改棋盘尺寸时格身份不变,越界格由渲染层过滤。

export function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

export function parseCellKey(key: string): CellRef | null {
  const m = /^(\d+),(\d+)$/.exec(key.trim())
  if (!m)
    return null
  return { col: Number(m[1]), row: Number(m[2]) }
}

// "0,3;5,10" -> Set<"col,row">。忽略空白与非法 token,自动去重。
export function parseHiddenCells(str: string): Set<string> {
  const out = new Set<string>()
  for (const token of str.split(';')) {
    const ref = parseCellKey(token)
    if (ref)
      out.add(cellKey(ref.col, ref.row))
  }
  return out
}

// Set -> "0,1;0,3;5,10"。按 col 再 row 数值升序,保证稳定可比对。
export function formatHiddenCells(set: Set<string>): string {
  const refs: CellRef[] = []
  for (const key of set) {
    const ref = parseCellKey(key)
    if (ref)
      refs.push(ref)
  }
  refs.sort((a, b) => a.col - b.col || a.row - b.row)
  return refs.map(r => cellKey(r.col, r.row)).join(';')
}
