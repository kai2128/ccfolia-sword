import type { CharPatch } from '../firestore-writer'
import type { BuffOp } from '@/core/buff/params-rmw'
import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaCharacter, CcfoliaParam } from '@/types/ccfolia'
import { collectBuffs } from '@/core/buff/collect'
import { appendBuff, applyBuffOps, removeBuff } from '@/core/buff/params-rmw'
import { commitWriteBatch, getCurrentRoomId } from '../firestore-writer'
import { serializedParamsUpdate } from '../params-queue'
import { useRoomCharactersStore } from '../room-characters-store'
import { getFirestoreApi } from '../webpack-hook'

// 多角色 / 多部位 buff 批量挂/卸。
//
// 写入策略(2026-05 改):
//   1. 优先 writeBatch ——
//      每个角色先在内存里 RMW(读 store 当前 params + applyBuffOps),
//      把 { params: nextParams } 攒进 CharPatch[],一并 commit。
//      绕开 serializedParamsUpdate 的 per-char 串行队列。
//   2. 抓不到 writeBatch → 回退到原 Promise.all(serializedParamsUpdate) 路径。
//
// 关于绕开 serializedParamsUpdate 的取舍:
//   - 该队列是为了避免同一角色上"并发 solo 操作"互相覆盖
//   - 批量 UI 场景下,GM 同时点单角色 buff 的概率极低
//   - 我们读 store 当前快照后立刻算 nextParams,中间窗口非常短
//   - 收益:300 角色 RMW 可秒级完成,而老路径走 N 次 onSnapshot ack 要几分钟
//
// 目标粒度走 part —— 同一角色多个 part 在内存里合并成一次写,不存在覆盖问题。

export interface BuffBatchTarget {
  characterId: string
  // 单部位/整体角色 partKey=''(等同于 collectBuffsForPart 的入参)
  partKey?: string
}

export interface ApplyBuffBatchAttach {
  kind: 'attach'
  targets: BuffBatchTarget[]
  buildBuff: (target: BuffBatchTarget) => BuffInstance
}

export interface ApplyBuffBatchDetach {
  kind: 'detach'
  targets: BuffBatchTarget[]
  // 按 definitionId 移除 —— 每个 target 身上所有 definitionId 匹配 + partKey 相等的 single buff 一并清掉
  definitionId: string
}

export interface ApplyBuffBatchClear {
  kind: 'clear'
  targets: BuffBatchTarget[]
  // true(默认 false)= 同时清除中心在该角色身上的 AoE buff(粒度仍是角色级而非 part)
  includeAoe?: boolean
  // true(默认 false)= 多部位角色,目标 partKey 非空时,把挂在角色 parent(partKey='')上的 single buff
  // 也算进来。批量场景选中所有 part 时常需要把"整体" / 历史遗留的 parent 级 buff 也清掉。
  includeParent?: boolean
}

export type ApplyBuffBatchInput = ApplyBuffBatchAttach | ApplyBuffBatchDetach | ApplyBuffBatchClear

export interface ApplyBuffBatchOptions {
  onProgress?: (done: number, total: number) => void
}

interface BatchFailure {
  characterId: string
  error: Error
}

export class BuffBatchError extends Error {
  failures: BatchFailure[]
  constructor(failures: BatchFailure[]) {
    const lines = failures.map(f => `${f.characterId}: ${f.error.message}`).join('\n')
    super(`批量 buff 操作部分失败 (${failures.length}):\n${lines}`)
    this.name = 'BuffBatchError'
    this.failures = failures
  }
}

interface CharGroup {
  partKeys: Set<string>
}

function groupByChar(targets: BuffBatchTarget[]): Map<string, CharGroup> {
  const byChar = new Map<string, CharGroup>()
  for (const t of targets) {
    const partKey = t.partKey ?? ''
    const entry = byChar.get(t.characterId)
    if (entry) {
      entry.partKeys.add(partKey)
    }
    else {
      byChar.set(t.characterId, { partKeys: new Set([partKey]) })
    }
  }
  return byChar
}

// 给一个角色计算 BuffOp 列表。返回 null = 跳过(无匹配 / 不需要写)。
function computeOpsForChar(
  characterId: string,
  partKeys: Set<string>,
  input: ApplyBuffBatchInput,
  char: CcfoliaCharacter | undefined,
): BuffOp[] | null {
  if (input.kind === 'attach') {
    const ops: BuffOp[] = []
    for (const partKey of partKeys) {
      const buff = input.buildBuff({ characterId, partKey: partKey || undefined })
      ops.push(appendBuff(buff))
    }
    return ops.length > 0 ? ops : null
  }

  // detach / clear:需要 char 当前快照
  if (!char)
    throw new Error(`character not found: ${characterId}`)

  let effectivePartKeys = partKeys
  if (input.kind === 'clear' && input.includeParent) {
    const hasNonEmpty = [...partKeys].some(k => k !== '')
    if (hasNonEmpty && !partKeys.has('')) {
      effectivePartKeys = new Set(partKeys)
      effectivePartKeys.add('')
    }
  }

  const matches = collectBuffs(char).filter((b) => {
    if (input.kind === 'detach') {
      if (b.definitionId !== input.definitionId)
        return false
      if (b.attachedTo.kind !== 'single')
        return false
      return effectivePartKeys.has(b.attachedTo.partKey ?? '')
    }
    // clear:清掉选中 part 上的所有 single buff;可选连中心是该角色的 AoE 一并清
    if (b.attachedTo.kind === 'single')
      return effectivePartKeys.has(b.attachedTo.partKey ?? '')
    if (b.attachedTo.kind === 'aoe')
      return input.includeAoe === true
    return false
  })
  if (matches.length === 0)
    return null
  return matches.map(b => removeBuff(b.id))
}

function hasWriteBatch(): boolean {
  return !!getFirestoreApi()?.firestore.writeBatch
}

export async function applyBuffBatch(input: ApplyBuffBatchInput, options: ApplyBuffBatchOptions = {}): Promise<void> {
  const { onProgress } = options
  if (input.targets.length === 0) {
    onProgress?.(0, 0)
    return
  }

  const byChar = groupByChar(input.targets)
  const store = useRoomCharactersStore()

  // 优先 writeBatch:内存里 RMW 完所有角色,一并提交
  if (hasWriteBatch()) {
    const updates: CharPatch[] = []
    const failures: BatchFailure[] = []
    for (const [characterId, { partKeys }] of byChar) {
      try {
        const char = store.byId(characterId)
        const ops = computeOpsForChar(characterId, partKeys, input, char)
        if (ops === null)
          continue
        const currentParams: CcfoliaParam[] = char?.params ?? []
        const nextParams = applyBuffOps(currentParams, ops)
        if (nextParams === currentParams)
          continue
        updates.push({ charId: characterId, patch: { params: nextParams } })
      }
      catch (e) {
        failures.push({ characterId, error: e instanceof Error ? e : new Error(String(e)) })
      }
    }

    if (updates.length > 0) {
      const roomId = getCurrentRoomId()
      if (!roomId)
        throw new Error('URL 不含 roomId')
      try {
        await commitWriteBatch(roomId, updates, onProgress)
      }
      catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        for (const u of updates)
          failures.push({ characterId: u.charId, error: err })
      }
    }
    else {
      onProgress?.(0, 0)
    }

    if (failures.length > 0)
      throw new BuffBatchError(failures)
    return
  }

  // 回退:原 Promise.all(serializedParamsUpdate) 路径
  const failures: BatchFailure[] = []
  const total = byChar.size
  let done = 0
  onProgress?.(0, total)

  await Promise.all([...byChar.entries()].map(async ([characterId, { partKeys }]) => {
    try {
      const char = store.byId(characterId)
      const ops = computeOpsForChar(characterId, partKeys, input, char)
      if (ops === null)
        return
      await serializedParamsUpdate(characterId, current => applyBuffOps(current, ops))
    }
    catch (e) {
      failures.push({ characterId, error: e as Error })
    }
    finally {
      onProgress?.(++done, total)
    }
  }))

  if (failures.length > 0)
    throw new BuffBatchError(failures)
}
