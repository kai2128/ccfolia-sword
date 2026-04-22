import type { CcfoliaParam } from '@/types/ccfolia'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { buffLabel, decodeBuff, encodeBuff, isBuffLabel } from '@/core/buff/codec'

// 纯函数:对一个 character 的 params 做一次 tick。
// turnsRemaining undefined → 不动(手动 buff);turnsRemaining > 0 → 减 1;到 0 / 已 0 → 移除该 buff entry。
// 无变化时返回原引用,serializedParamsUpdate 跳过空写。
export function applyBuffTickToParams(current: CcfoliaParam[]): CcfoliaParam[] {
  let dirty = false
  const next: CcfoliaParam[] = []
  for (const param of current) {
    if (!isBuffLabel(param.label)) {
      next.push(param)
      continue
    }
    const buff = decodeBuff(param.value)
    if (!buff) {
      next.push(param)
      continue
    }
    if (buff.turnsRemaining === undefined) {
      next.push(param)
      continue
    }
    const newTurns = buff.turnsRemaining - 1
    if (newTurns <= 0) {
      dirty = true
      continue
    }
    const updated = { ...buff, turnsRemaining: newTurns }
    next.push({ label: buffLabel(buff.id), value: encodeBuff(updated) })
    dirty = true
  }
  return dirty ? next : current
}

export async function tickBuffTurnsForCharacter(characterId: string): Promise<void> {
  await serializedParamsUpdate(characterId, applyBuffTickToParams)
}

export async function tickBuffTurnsForAllCharacters(): Promise<void> {
  const chars = useRoomCharactersStore()
  await Promise.all(chars.all.map(c => tickBuffTurnsForCharacter(c._id)))
}
