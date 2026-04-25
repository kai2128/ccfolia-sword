import type { CcfoliaParam } from '@/types/ccfolia'
import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { buffLabel, decodeBuff, encodeBuff, isBuffLabel } from '@/core/buff/codec'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'

export interface TickPrompt {
  characterId: string
  buffId: string
  buffName: string
  prompt: string
}

interface TickResult {
  next: CcfoliaParam[]
  prompts: TickPrompt[]
}

// 纯函数:对一个 character 的 params 做一次 tick。
// turnsRemaining undefined → 不动(手动 buff);turnsRemaining > 0 → 减 1;到 0 / 已 0 → 移除该 buff entry。
// 同时收集 enabled 且带 tickPrompt 的 buff(扣减前收,所以最后一回合也会弹)。
// 无变化时返回原引用,serializedParamsUpdate 跳过空写。
export function applyBuffTickToParams(
  current: CcfoliaParam[],
  characterId: string,
): TickResult {
  let dirty = false
  const next: CcfoliaParam[] = []
  const prompts: TickPrompt[] = []

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

    // 扣减前收 prompt:enabled && 非空 prompt
    if (buff.enabled && buff.snapshot.tickPrompt) {
      prompts.push({
        characterId,
        buffId: buff.id,
        buffName: buff.snapshot.name,
        prompt: buff.snapshot.tickPrompt,
      })
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

  return {
    next: dirty ? next : current,
    prompts,
  }
}

export async function tickBuffTurnsForCharacter(characterId: string): Promise<TickPrompt[]> {
  const collected: TickPrompt[] = []
  const chars = useRoomCharactersStore()
  const char = chars.byId(characterId)
  if (!char)
    return collected

  // 死人不收 prompt(但仍 tick turnsRemaining)
  const labelMap = useSettingsStore().statusLabelMap
  const hp = readStatusSlot(char.status, 'hp', labelMap)
  const alive = !hp || hp.value > 0

  await serializedParamsUpdate(characterId, (current) => {
    const { next, prompts } = applyBuffTickToParams(current, characterId)
    if (alive)
      collected.push(...prompts)
    return next
  })

  return collected
}

export async function tickBuffTurnsForAllCharacters(): Promise<TickPrompt[]> {
  const chars = useRoomCharactersStore()
  const results = await Promise.all(chars.all.map(c => tickBuffTurnsForCharacter(c._id)))
  return results.flat()
}
