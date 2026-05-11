import type { BuffOp } from '@/core/buff/params-rmw'
import type { BuffInstance } from '@/types/buff-v3'
import { collectBuffs } from '@/core/buff/collect'
import { appendBuff, applyBuffOps, removeBuff } from '@/core/buff/params-rmw'
import { serializedParamsUpdate } from '../params-queue'
import { useRoomCharactersStore } from '../room-characters-store'

// 多角色 / 多部位 buff 批量挂/卸。沿用 apply-action-batch.ts 的"按 char RMW + Promise.all"约定。
//
// 目标粒度走 part —— BatchApplyDialog 的勾选与 RosterPartRow 一致,每个 actorRef 是一个 target。
// 同一角色的多个 part 必须合并成一次 serializedParamsUpdate(对 params 数组字段级合并写),
// 否则后写覆盖前写。
//
// Detach 仅匹配 single-target buff 且 partKey 严格相等 —— AoE buff 由中心角色管,不参与 part 级清除,
// 与 RosterPartRow / collectBuffsForPart 保持一致。

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
  // 写每个角色完成(成功或失败)后回调,total = 按 characterId 去重后的并发数。
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

export async function applyBuffBatch(input: ApplyBuffBatchInput, options: ApplyBuffBatchOptions = {}): Promise<void> {
  const { onProgress } = options
  if (input.targets.length === 0) {
    onProgress?.(0, 0)
    return
  }

  const byChar = groupByChar(input.targets)
  const failures: BatchFailure[] = []
  const total = byChar.size
  let done = 0
  onProgress?.(0, total)

  await Promise.all([...byChar.entries()].map(async ([characterId, { partKeys }]) => {
    try {
      if (input.kind === 'attach') {
        const ops: BuffOp[] = []
        for (const partKey of partKeys) {
          const buff = input.buildBuff({ characterId, partKey: partKey || undefined })
          ops.push(appendBuff(buff))
        }
        await serializedParamsUpdate(characterId, current => applyBuffOps(current, ops))
        return
      }

      // detach / clear:都需要先读当前快照过滤匹配实例
      const char = useRoomCharactersStore().byId(characterId)
      if (!char)
        throw new Error(`character not found: ${characterId}`)

      // clear + includeParent:任意非空 partKey 命中时把 parent('')也加进匹配集
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
        return

      const ops = matches.map(b => removeBuff(b.id))
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
