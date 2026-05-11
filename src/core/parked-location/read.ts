import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { ParkedPayload } from '@/types/parked-location'
import { PARKED_LABEL } from '@/types/parked-location'

// 从 params 中解出停放位坐标。坏 JSON / 缺字段 / 字段类型不对一律返 null,避免脏数据触发错误送回。
export function readParkedLocation(char: CcfoliaCharacter): ParkedPayload | null {
  const param = char.params.find(p => p.label === PARKED_LABEL)
  if (!param)
    return null

  let parsed: Partial<ParkedPayload> | null = null
  try {
    parsed = JSON.parse(param.value) as Partial<ParkedPayload>
  }
  catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object')
    return null
  if (typeof parsed.x !== 'number' || !Number.isFinite(parsed.x))
    return null
  if (typeof parsed.y !== 'number' || !Number.isFinite(parsed.y))
    return null

  return {
    x: parsed.x,
    y: parsed.y,
    savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
  }
}
