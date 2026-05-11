import type { GridConfig } from '@/core/range/types'
import { num } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { readParkedLocation } from '@/core/parked-location'
import { isPieceOffBoard } from '@/core/range'
import { saveCharacterParked } from './save-character-parked'
import { sendCharacterToParked } from './send-character-to-parked'

// 一批角色的「板外位置」操作。同 apply-move-batch 范式:
// 各 char 互不影响,并行 + Promise.allSettled,失败汇总回报。
// skipped 用来表达"语义不允许"(非错):save 时角色不在场外 / send 时没保存过 → 计入 skipped。

export interface ParkedBatchResult {
  ok: number
  skipped: number
  failures: Array<{ charId: string, error: Error }>
}

export type ProgressCallback = (done: number, total: number) => void

async function runParallel(
  jobs: Array<{ charId: string, run: () => Promise<void> }>,
  skipped: number,
  onProgress?: ProgressCallback,
): Promise<ParkedBatchResult> {
  if (jobs.length === 0) {
    onProgress?.(0, 0)
    return { ok: 0, skipped, failures: [] }
  }
  const total = jobs.length
  let done = 0
  onProgress?.(0, total)
  const settled = await Promise.allSettled(jobs.map(j =>
    j.run().finally(() => onProgress?.(++done, total)),
  ))
  const failures: ParkedBatchResult['failures'] = []
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]
    if (r.status === 'rejected')
      failures.push({ charId: jobs[i].charId, error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)) })
  }
  return { ok: settled.length - failures.length, skipped, failures }
}

// 仅对当前位于板外的角色保存板外位置 (x, y);场上的角色计入 skipped 不写。
export async function applyBatchSavePark(charIds: string[], grid: GridConfig, onProgress?: ProgressCallback): Promise<ParkedBatchResult> {
  const store = useRoomCharactersStore()
  const jobs: Array<{ charId: string, run: () => Promise<void> }> = []
  let skipped = 0
  for (const id of charIds) {
    const char = store.byId(id)
    if (!char) {
      skipped++
      continue
    }
    const widthCells = num(char.width, 1)
    const heightCells = num(char.height, 1)
    if (!isPieceOffBoard({ x: char.x, y: char.y, widthCells, heightCells }, grid)) {
      skipped++
      continue
    }
    const x = char.x as number
    const y = char.y as number
    jobs.push({ charId: id, run: () => saveCharacterParked(id, x, y) })
  }
  return runParallel(jobs, skipped, onProgress)
}

// 把所有保存过板外位置的角色送回。没保存过的计入 skipped。
export async function applyBatchSendToPark(
  charIds: string[],
  opts: { restoreHpMp: boolean },
  onProgress?: ProgressCallback,
): Promise<ParkedBatchResult> {
  const store = useRoomCharactersStore()
  const jobs: Array<{ charId: string, run: () => Promise<void> }> = []
  let skipped = 0
  for (const id of charIds) {
    const char = store.byId(id)
    if (!char || !readParkedLocation(char)) {
      skipped++
      continue
    }
    jobs.push({ charId: id, run: () => sendCharacterToParked(id, { restoreHpMp: opts.restoreHpMp }) })
  }
  return runParallel(jobs, skipped, onProgress)
}
