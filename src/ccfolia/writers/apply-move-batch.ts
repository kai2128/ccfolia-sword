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

export type ProgressCallback = (done: number, total: number) => void

async function runBatch(
  charIds: string[],
  worker: (id: string) => Promise<void>,
  onProgress?: ProgressCallback,
): Promise<MoveBatchResult> {
  if (charIds.length === 0) {
    onProgress?.(0, 0)
    return { ok: 0, failures: [] }
  }
  const total = charIds.length
  let done = 0
  onProgress?.(0, total)
  const settled = await Promise.allSettled(charIds.map(id =>
    worker(id).finally(() => onProgress?.(++done, total)),
  ))
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
  onProgress?: ProgressCallback
}): Promise<MoveBatchResult> {
  return runBatch(opts.charIds, id => setCharacterCell(id, opts.cellRef, opts.grid), opts.onProgress)
}

export function applyBatchMoveOffBoard(
  charIds: string[],
  grid: GridConfig,
  onProgress?: ProgressCallback,
): Promise<MoveBatchResult> {
  return runBatch(charIds, id => moveCharacterOffBoard(id, grid), onProgress)
}

export function applyBatchShift(opts: {
  charIds: string[]
  dx: number
  dy: number
  grid: GridConfig
  onProgress?: ProgressCallback
}): Promise<MoveBatchResult> {
  return runBatch(opts.charIds, id => moveCharacterByCells(id, opts.dx, opts.dy, opts.grid), opts.onProgress)
}
