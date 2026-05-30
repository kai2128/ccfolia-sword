import type { CcfoliaCharacter } from '@/types/ccfolia'

// 利用 RTK/Immer 引用复用:未变的 entity 跨帧同引用。
// prev 是上一帧的 id→entity 快照;next 是本帧 materialize 出来的 active 列表。
// 返回本帧真正变化的 id(含新增)、已移除的 id,以及成员是否增减。
export interface ActiveDiff {
  changedIds: string[]
  removedIds: string[]
  membershipChanged: boolean
}

export function diffActiveCharacters(
  prev: Map<string, CcfoliaCharacter>,
  next: CcfoliaCharacter[],
): ActiveDiff {
  const changedIds: string[] = []
  const nextIds = new Set<string>()
  let added = false

  for (const c of next) {
    nextIds.add(c._id)
    const before = prev.get(c._id)
    if (before === undefined)
      added = true
    if (before !== c)
      changedIds.push(c._id)
  }

  const removedIds: string[] = []
  for (const id of prev.keys()) {
    if (!nextIds.has(id))
      removedIds.push(id)
  }

  return {
    changedIds,
    removedIds,
    membershipChanged: added || removedIds.length > 0,
  }
}
