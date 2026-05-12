import type { CharPatch } from '../firestore-writer'
import type { GridConfig } from '@/core/range/types'
import { num } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { buildSaveParkedParams, readParkedLocation } from '@/core/parked-location'
import { isPieceOffBoard } from '@/core/range'
import { useSettingsStore } from '@/stores/settings'
import { commitWriteBatch, getCurrentRoomId } from '../firestore-writer'
import { getFirestoreApi } from '../webpack-hook'
import { computeRestoredStatus } from './restore-hp-mp-to-max'
import { saveCharacterParked } from './save-character-parked'
import { sendCharacterToParked } from './send-character-to-parked'

// 一批角色的「板外位置」操作。沿用 apply-move-batch 的策略:
// 优先 writeBatch(N → 少量 RPC,适合 300+ 量级),抓不到回退到老的 Promise.allSettled 路径。
//
// skipped 用来表达"语义不允许"(非错):
//   - save 时角色不在场外
//   - send 时该角色没保存过 cs_park

export interface ParkedBatchResult {
  ok: number
  skipped: number
  failures: Array<{ charId: string, error: Error }>
}

export type ProgressCallback = (done: number, total: number) => void

function hasWriteBatch(): boolean {
  return !!getFirestoreApi()?.firestore.writeBatch
}

// 公共回退路径:Promise.allSettled 每角色一份 setDoc
async function runParallelFallback(
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

// writeBatch 一并提交。失败时把这批角色塞 failures。
async function commitParkedPatchesViaWriteBatch(
  updates: CharPatch[],
  skipped: number,
  onProgress?: ProgressCallback,
): Promise<ParkedBatchResult> {
  if (updates.length === 0) {
    onProgress?.(0, 0)
    return { ok: 0, skipped, failures: [] }
  }
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')
  try {
    await commitWriteBatch(roomId, updates, onProgress)
    return { ok: updates.length, skipped, failures: [] }
  }
  catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    return { ok: 0, skipped, failures: updates.map(u => ({ charId: u.charId, error: err })) }
  }
}

// 仅对当前位于板外的角色保存板外位置 (x, y);场上的角色计入 skipped 不写。
export async function applyBatchSavePark(
  charIds: string[],
  grid: GridConfig,
  onProgress?: ProgressCallback,
): Promise<ParkedBatchResult> {
  const store = useRoomCharactersStore()

  if (hasWriteBatch()) {
    const updates: CharPatch[] = []
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
      const nextParams = buildSaveParkedParams(char.params, x, y, Date.now())
      updates.push({ charId: id, patch: { params: nextParams } })
    }
    return commitParkedPatchesViaWriteBatch(updates, skipped, onProgress)
  }

  // 回退:老路径走 saveCharacterParked(内部 serializedParamsUpdate)
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
  return runParallelFallback(jobs, skipped, onProgress)
}

// 把所有保存过板外位置的角色送回。没保存过的计入 skipped。
// opts.restoreHpMp = true 时,把回满 status 和 {x,y} 合并到一次 setDoc(比原来两步快)。
export async function applyBatchSendToPark(
  charIds: string[],
  opts: { restoreHpMp: boolean },
  onProgress?: ProgressCallback,
): Promise<ParkedBatchResult> {
  const store = useRoomCharactersStore()

  if (hasWriteBatch()) {
    const updates: CharPatch[] = []
    let skipped = 0
    const labelMap = opts.restoreHpMp ? useSettingsStore().statusLabelMap : null
    for (const id of charIds) {
      const char = store.byId(id)
      if (!char) {
        skipped++
        continue
      }
      const parked = readParkedLocation(char)
      if (!parked) {
        skipped++
        continue
      }
      const patch: Record<string, unknown> = { x: parked.x, y: parked.y }
      // 选了「+ 回满 HP/MP」时把 status 合并写,一次 setDoc 同时改位置和血量
      if (labelMap) {
        const { nextStatus, changed } = computeRestoredStatus(char, labelMap)
        if (changed)
          patch.status = nextStatus
      }
      updates.push({ charId: id, patch })
    }
    return commitParkedPatchesViaWriteBatch(updates, skipped, onProgress)
  }

  // 回退:老路径,sendCharacterToParked 内部串行 setDoc + restoreHpMpToMax
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
  return runParallelFallback(jobs, skipped, onProgress)
}
