// 威力命令解析器。第一版只覆盖 k / @ / +/- / h。
// 为兼容设计文档中的两种写法，`kh30` 与 `k30h` 都视为半减。

export interface ParsedPowerCommand {
  power: number
  critThreshold: number
  modifier: number
  half: boolean
}

export type ParseResult
  = | { ok: true, value: ParsedPowerCommand }
    | { ok: false, reason: string }

const POWER_PREFIX_RE = /^kh?\d+/
const TOKEN_RE = /@\d+|h(?:[+\-]\d+)?|[+\-]\d+/g

export function parsePowerCommand(input: string): ParseResult {
  const src = input.trim()
  if (!src)
    return { ok: false, reason: '公式为空' }

  const powerPrefix = src.match(POWER_PREFIX_RE)?.[0]
  if (!powerPrefix)
    return { ok: false, reason: '必须以 k<威力> 或 kh<威力> 开头' }

  const prefixHalf = powerPrefix.startsWith('kh')
  const power = Number(powerPrefix.slice(prefixHalf ? 2 : 1))
  const rest = src.slice(powerPrefix.length)

  let half = prefixHalf
  let critThreshold: number | undefined
  let modifier: number | undefined

  TOKEN_RE.lastIndex = 0
  let cursor = 0
  let tokenMatch: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((tokenMatch = TOKEN_RE.exec(rest)) !== null) {
    if (tokenMatch.index !== cursor)
      return { ok: false, reason: `第 ${powerPrefix.length + cursor + 1} 位附近有非法字符` }

    const token = tokenMatch[0]
    cursor += token.length

    if (token.startsWith('@')) {
      if (critThreshold !== undefined)
        return { ok: false, reason: '@ 只能出现一次' }
      critThreshold = Number(token.slice(1))
      continue
    }

    if (token.startsWith('h')) {
      if (half)
        return { ok: false, reason: 'h 只能出现一次' }
      half = true
      if (token.length > 1) {
        if (modifier !== undefined)
          return { ok: false, reason: 'h 修正与独立修正不能同时出现' }
        modifier = Number(token.slice(1))
      }
      continue
    }

    if (modifier !== undefined)
      return { ok: false, reason: '修正只能出现一次' }
    modifier = Number(token)
  }

  if (cursor !== rest.length)
    return { ok: false, reason: `尾部有非法字符: ${rest.slice(cursor)}` }

  return {
    ok: true,
    value: {
      power,
      critThreshold: critThreshold ?? (half ? 13 : 10),
      modifier: modifier ?? 0,
      half,
    },
  }
}
