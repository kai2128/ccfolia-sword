import type { GridConfig } from '@/core/range/types'
import { moveCharacterByCells } from './move-character-by-cells'
import { moveCharacterOffBoard } from './move-character-off-board'
import { setCharacterCell } from './set-character-cell'

// 一批角色的位置改写。和 apply-action-batch 同样道理:
// 名字里的 "Batch" 指"一批变更",**不是** Firestore writeBatch。
// 各 char 的 x/y 写互不影响,直接 Promise.allSettled 并行,失败的攒起来回报上层,
// 不抛错也不让一个失败影响其他。调用方用 onCanvasIds 自行决定要传哪些 charId 进来。

export interface MoveBatchResult {
  ok: number
  failures: Array<{ charId: string, error: Error }>
}

async function runBatch(
  charIds: string[],
  worker: (id: string) => Promise<void>,
): Promise<MoveBatchResult> {
  if (charIds.length === 0)
    return { ok: 0, failures: [] }
  const settled = await Promise.allSettled(charIds.map(worker))
  const failures: MoveBatchResult['failures'] = []
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]
    if (r.status === 'rejected')
      failures.push({ charId: charIds[i], error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)) })
  }
  return { ok: settled.length - failures.length, failures }
}

export function applyBatchMoveToCell(opts: {
  charIds: string[]
  cellRef: string
  grid: GridConfig
}): Promise<MoveBatchResult> {
  return runBatch(opts.charIds, id => setCharacterCell(id, opts.cellRef, opts.grid))
}

export function applyBatchMoveOffBoard(
  charIds: string[],
  grid: GridConfig,
): Promise<MoveBatchResult> {
  return runBatch(charIds, id => moveCharacterOffBoard(id, grid))
}

export function applyBatchShift(opts: {
  charIds: string[]
  dx: number
  dy: number
  grid: GridConfig
}): Promise<MoveBatchResult> {
  return runBatch(opts.charIds, id => moveCharacterByCells(id, opts.dx, opts.dy, opts.grid))
}
