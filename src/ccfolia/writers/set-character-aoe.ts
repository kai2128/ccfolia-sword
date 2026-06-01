import type { StoredAoe } from '@/core/range'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { applyAoeOps, setAoe } from '@/core/range'

// upsert(按 id):新增或就地编辑锚定角色身上的一个 AOE 指示器。
// 走 params RMW 队列写 ccfolia,onSnapshot 跨端同步。
export async function setCharacterAoe(characterId: string, aoe: StoredAoe): Promise<void> {
  await serializedParamsUpdate(characterId, current => applyAoeOps(current, [setAoe(aoe)]))
}
