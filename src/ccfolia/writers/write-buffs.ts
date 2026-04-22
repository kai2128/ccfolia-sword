import type { BuffPayload } from '@/types/buff'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { createLogger } from '@/infra/log'
import { buffLabel, isBuffLabel } from '@/types/buff'
import { serializedParamsUpdate } from '../params-queue'

const log = createLogger('write-buffs')

function uuid(): string {
  const cryptoValue = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoValue?.randomUUID)
    return cryptoValue.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function attachBuff(
  char: CcfoliaCharacter,
  payload: Omit<BuffPayload, 'v' | 'id' | 'attachedAt'> & Partial<Pick<BuffPayload, 'id'>>,
): Promise<BuffPayload> {
  const id = payload.id ?? uuid()
  const buff: BuffPayload = {
    ...payload,
    v: 1,
    id,
    attachedAt: { round: 0, timestamp: Date.now() },
  }
  const label = buffLabel(id)

  await serializedParamsUpdate(char._id, params => [
    ...params.filter(param => param.label !== label),
    { label, value: JSON.stringify(buff) },
  ])

  return buff
}

export async function detachBuff(char: CcfoliaCharacter, buffId: string): Promise<void> {
  const label = buffLabel(buffId)
  await serializedParamsUpdate(char._id, (params) => {
    const next = params.filter(param => param.label !== label)
    return next.length === params.length ? params : next
  })
}

export function listBuffs(char: CcfoliaCharacter): BuffPayload[] {
  const out: BuffPayload[] = []
  for (const param of char.params) {
    if (!isBuffLabel(param.label))
      continue
    try {
      const parsed = JSON.parse(param.value) as BuffPayload
      if (parsed && typeof parsed === 'object' && parsed.v === 1)
        out.push(parsed)
    }
    catch {
      log.warn('bad buff payload', { label: param.label })
    }
  }
  return out
}
