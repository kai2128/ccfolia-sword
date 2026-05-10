// 拥挤判定:基于棋子中心点,任一棋子距离 ≤ thresholdCells * cellSize 即标为拥挤。
// 用现有 RangeCircle 同源的「网格距离」语义,GM 心智模型一致。
//
// 复杂度 O(n²) — 战斗场景棋子通常 < 50 个,完全够用,无需 KD-tree。
// 输入 cellSize / thresholdCells / pieces 都是纯数据,SceneOverlayLayer
// 在 entries computed 里直接 call,Vue 反应性会随 grid / pieces 变化重算。

export interface PieceRect {
  id: string
  centerX: number
  centerY: number
}

export function computeCrowded(
  pieces: PieceRect[],
  cellSize: number,
  thresholdCells: number,
): Set<string> {
  const result = new Set<string>()
  if (pieces.length < 2 || cellSize <= 0 || thresholdCells <= 0)
    return result
  // 用平方距离比较,省 n² 次 sqrt。
  const limit = thresholdCells * cellSize
  const limitSq = limit * limit
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i]
    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j]
      const dx = a.centerX - b.centerX
      const dy = a.centerY - b.centerY
      if (dx * dx + dy * dy <= limitSq) {
        result.add(a.id)
        result.add(b.id)
      }
    }
  }
  return result
}
