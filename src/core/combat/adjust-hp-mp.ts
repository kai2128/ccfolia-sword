// HP/MP 调整的纯函数计算层。
// CLAUDE.md 约定:过量治疗/临时 buff 允许超上限,默认不截 max(MP 仍 0 截底)。
// 任何写回前都应走 resolveNewValue,保证 batch / single 行为一致。

export type AdjustMode = 'delta' | 'absolute'

export interface ResolveOptions {
  mode: AdjustMode
  // delta:加到 current;absolute:直接设为该值。允许负数。
  input: number
  // status.max,absolute 模式下也参考它做 clampMax 截顶
  max: number
  // true = 不超过 max(治疗到 max 截);false(默认)= 允许溢出(过量治疗 / 临时 buff)
  clampMax?: boolean
  // true(默认)= 不低于 0(MP/HP 都用)。
  clampMin?: boolean
}

export function resolveNewValue(current: number, opts: ResolveOptions): number {
  const { mode, input, max, clampMax = false, clampMin = true } = opts
  let next = mode === 'delta' ? current + input : input
  if (clampMax)
    next = Math.min(next, max)
  if (clampMin)
    next = Math.max(0, next)
  return next
}
