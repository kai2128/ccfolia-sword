import type { CharPatch } from '../firestore-writer'
import type { GridConfig } from '@/core/range/types'
import { num } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { boxTopLeftForCellBottomCenter, cellToPx, parseCellRef, pieceBottomCenter, pxToCell } from '@/core/range'
import { commitWriteBatch, getCurrentRoomId } from '../firestore-writer'
import { getFirestoreApi } from '../webpack-hook'
import { moveCharacterByCells } from './move-character-by-cells'
import { moveCharacterOffBoard } from './move-character-off-board'
import { setCharacterCell } from './set-character-cell'

// 一批角色的位置改写。沿用 apply-action-batch 的策略:
//   1. 优先 writeBatch:把 N 个角色合成少量 RPC,几百角色秒级完成
//   2. 抓不到 writeBatch 时回退到 Promise.allSettled(setDoc) 老路径
//
// 失败语义:
//   - writeBatch 整批原子,一个 chunk 失败 → 该 chunk 所有 charId 进 failures
//   - 回退路径每角色独立失败,与原行为一致

export interface MoveBatchResult {
  ok: number
  failures: Array<{ charId: string, error: Error }>
}

export type ProgressCallback = (done: number, total: number) => void

const CELL_BOUNDARY_EPS = 0.001

// 计算一个角色在 enter/set 模式下的 top-left(失败抛错,上层 catch 进 failures)
function computeCellTopLeft(charId: string, cellRef: string, grid: GridConfig): { x: number, y: number } {
  const cell = parseCellRef(cellRef, grid)
  if (!cell)
    throw new Error(`无效格位:${cellRef}`)
  const char = useRoomCharactersStore().byId(charId)
  if (!char)
    throw new Error(`角色不存在:${charId}`)
  const size = { widthCells: num(char.width, 1), heightCells: num(char.height, 1) }
  return boxTopLeftForCellBottomCenter(cellToPx(cell, grid), size, grid)
}

// 计算 off-board 位置,与角色无关(全部用同一个收纳位)
function computeOffBoardCoords(grid: GridConfig): { x: number, y: number } {
  return { x: grid.originPx.x - grid.cellSizePx * 2, y: grid.originPx.y }
}

// 计算 shift 模式下的 top-left,板外角色抛错
function computeShiftTopLeft(charId: string, dx: number, dy: number, grid: GridConfig): { x: number, y: number } | null {
  const char = useRoomCharactersStore().byId(charId)
  if (!char)
    throw new Error(`角色不存在:${charId}`)
  const size = { widthCells: num(char.width, 1), heightCells: num(char.height, 1) }
  const bottomCenter = pieceBottomCenter({ x: char.x as number, y: char.y as number, ...size }, grid)
  const cur = pxToCell({ x: bottomCenter.x, y: bottomCenter.y - CELL_BOUNDARY_EPS }, grid)
  if (!cur)
    throw new Error('角色在板外,无法按格相对移动')
  const nextCol = Math.max(0, Math.min(grid.cols - 1, cur.col + dx))
  const nextRow = Math.max(0, Math.min(grid.rows - 1, cur.row + dy))
  if (nextCol === cur.col && nextRow === cur.row)
    return null // 无位移,跳过
  return boxTopLeftForCellBottomCenter(cellToPx({ col: nextCol, row: nextRow }, grid), size, grid)
}

interface ComputedMove {
  charId: string
  patch: { x: number, y: number }
}

interface ComputeResult {
  moves: ComputedMove[]
  failures: Array<{ charId: string, error: Error }>
}

function tryCompute(charIds: string[], fn: (id: string) => { x: number, y: number } | null): ComputeResult {
  const moves: ComputedMove[] = []
  const failures: ComputeResult['failures'] = []
  for (const id of charIds) {
    try {
      const patch = fn(id)
      if (patch !== null)
        moves.push({ charId: id, patch })
    }
    catch (e) {
      failures.push({ charId: id, error: e instanceof Error ? e : new Error(String(e)) })
    }
  }
  return { moves, failures }
}

// 把 ComputedMove[] 走 writeBatch 一并提交。失败时把这批角色塞进 failures 而不是抛。
async function commitMovesViaWriteBatch(moves: ComputedMove[], onProgress?: ProgressCallback): Promise<{ ok: number, failures: MoveBatchResult['failures'] }> {
  if (moves.length === 0) {
    onProgress?.(0, 0)
    return { ok: 0, failures: [] }
  }
  const roomId = getCurrentRoomId()
  if (!roomId)
    throw new Error('URL 不含 roomId')
  const updates: CharPatch[] = moves.map(m => ({ charId: m.charId, patch: { x: m.patch.x, y: m.patch.y } }))
  try {
    await commitWriteBatch(roomId, updates, onProgress)
    return { ok: moves.length, failures: [] }
  }
  catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    return { ok: 0, failures: moves.map(m => ({ charId: m.charId, error: err })) }
  }
}

// 回退路径:沿用原 Promise.allSettled(单角色 writer)模式
async function runBatchFallback(
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

function hasWriteBatch(): boolean {
  return !!getFirestoreApi()?.firestore.writeBatch
}

export async function applyBatchMoveToCell(opts: {
  charIds: string[]
  cellRef: string
  grid: GridConfig
  onProgress?: ProgressCallback
}): Promise<MoveBatchResult> {
  if (hasWriteBatch()) {
    const { moves, failures } = tryCompute(opts.charIds, id => computeCellTopLeft(id, opts.cellRef, opts.grid))
    const result = await commitMovesViaWriteBatch(moves, opts.onProgress)
    return { ok: result.ok, failures: [...failures, ...result.failures] }
  }
  return runBatchFallback(opts.charIds, id => setCharacterCell(id, opts.cellRef, opts.grid), opts.onProgress)
}

export async function applyBatchMoveOffBoard(
  charIds: string[],
  grid: GridConfig,
  onProgress?: ProgressCallback,
): Promise<MoveBatchResult> {
  if (hasWriteBatch()) {
    const target = computeOffBoardCoords(grid)
    const moves: ComputedMove[] = charIds.map(id => ({ charId: id, patch: target }))
    const result = await commitMovesViaWriteBatch(moves, onProgress)
    return { ok: result.ok, failures: result.failures }
  }
  return runBatchFallback(charIds, id => moveCharacterOffBoard(id, grid), onProgress)
}

export async function applyBatchShift(opts: {
  charIds: string[]
  dx: number
  dy: number
  grid: GridConfig
  onProgress?: ProgressCallback
}): Promise<MoveBatchResult> {
  if (hasWriteBatch()) {
    const { moves, failures } = tryCompute(opts.charIds, id => computeShiftTopLeft(id, opts.dx, opts.dy, opts.grid))
    const result = await commitMovesViaWriteBatch(moves, opts.onProgress)
    return { ok: result.ok, failures: [...failures, ...result.failures] }
  }
  return runBatchFallback(opts.charIds, id => moveCharacterByCells(id, opts.dx, opts.dy, opts.grid), opts.onProgress)
}
