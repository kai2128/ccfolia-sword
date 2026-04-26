import type { CellRef, GridConfig } from './types'

const LETTER_A = 'A'.charCodeAt(0)

export function parseCellRef(raw: string, cfg: GridConfig): CellRef | null {
  const trimmed = raw.trim()
  const m = /^(\d+)([a-z])$/i.exec(trimmed)
  if (!m)
    return null
  const rowNum = Number(m[1])
  const letter = m[2].toUpperCase()
  const col = letter.charCodeAt(0) - LETTER_A
  const row = rowNum - 1
  if (col < 0 || col >= cfg.cols)
    return null
  if (row < 0 || row >= cfg.rows)
    return null
  return { col, row }
}

export function formatCellRef(ref: CellRef): string {
  const letter = String.fromCharCode(LETTER_A + ref.col)
  return `${ref.row + 1}${letter}`
}

// 解析相对位移输入。和 parseCellRef 不冲突 —— parseCellRef 是 <数字><字母>,这里是
//   "u10" / "d3" / "l2" / "r5"   方向字母 + 正整数(<字母><数字>,顺序刚好相反)
//   "+2,-3" / "2,-3"             dRow,dCol(逗号分隔,符号可选;dy=row 方向,dx=col 方向)
// 失败返回 null,调用方再去试 parseCellRef 当绝对坐标。
export function parseCellDelta(raw: string): { dx: number, dy: number } | null {
  const s = raw.trim().toLowerCase()
  if (!s)
    return null

  const comma = /^([+-]?\d+)\s*,\s*([+-]?\d+)$/.exec(s)
  if (comma) {
    const dy = Number(comma[1])
    const dx = Number(comma[2])
    if (Number.isFinite(dx) && Number.isFinite(dy))
      return { dx, dy }
  }

  const dir = /^([udlr])\s*(\d+)$/.exec(s)
  if (dir) {
    const n = Number(dir[2])
    if (!Number.isFinite(n) || n <= 0)
      return null
    switch (dir[1]) {
      case 'u': return { dx: 0, dy: -n }
      case 'd': return { dx: 0, dy: n }
      case 'l': return { dx: -n, dy: 0 }
      case 'r': return { dx: n, dy: 0 }
    }
  }

  return null
}
