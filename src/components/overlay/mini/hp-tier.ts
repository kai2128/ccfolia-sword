// HP 血量分档配色 —— 全体 HP 指示器(bar / pip / 文字)共用一处真源。
//   ≤25%(或 danger)濒死红 · ≤50% 警戒橙黄 · 否则安全绿。
// fill = 条填充底色 / SVG 主色;shine = 高光色 & 数值文字色。
export interface HpTier { fill: string, shine: string }

export function hpTier(ratio: number, danger = false): HpTier {
  if (danger || ratio <= 0.25)
    return { fill: '#d04a4a', shine: '#ffb3b3' }
  if (ratio <= 0.5)
    return { fill: '#d99a2b', shine: '#ffd873' }
  return { fill: '#3aa86a', shine: '#b8f5c8' }
}
