import type { CellRef, GridConfig } from './types'

const LETTER_A = 'A'.charCodeAt(0)

export function parseCellRef(raw: string, cfg: GridConfig): CellRef | null {
  const trimmed = raw.trim()
  const m = /^(\d+)([A-Za-z])$/.exec(trimmed)
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
