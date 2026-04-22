import type { BuffInstance } from '@/types/buff-v3'

export const BUFF_LABEL_PREFIX = 'cs_buff_'

export function buffLabel(buffId: string): string {
  return `${BUFF_LABEL_PREFIX}${buffId}`
}

export function isBuffLabel(label: string): boolean {
  return label.startsWith(BUFF_LABEL_PREFIX)
}

export function encodeBuff(buff: BuffInstance): string {
  return JSON.stringify(buff)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isLifecycle(value: unknown): value is BuffInstance['lifecycle'] {
  return value === 'encounter' || value === 'persistent'
}

function isAttachedTarget(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== 'string')
    return false
  if (value.kind === 'single')
    return typeof value.characterId === 'string'
  if (value.kind === 'aoe')
    return typeof value.centerCharacterId === 'string' && typeof value.radius === 'number'
  return false
}

function isPolarity(value: unknown): boolean {
  return value === 'positive' || value === 'negative'
}

function isSnapshot(value: unknown): boolean {
  return isRecord(value)
    && typeof value.name === 'string'
    && typeof value.icon === 'string'
    && typeof value.description === 'string'
    && Array.isArray(value.modifiers)
    && isPolarity(value.polarity)
}

export function decodeBuff(raw: string): BuffInstance | null {
  try {
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed))
      return null
    // normalize polarity 必须在 isSnapshot 之前(isSnapshot 已扩成检查 polarity 合法值)
    if (isRecord(parsed.snapshot) && !isPolarity(parsed.snapshot.polarity))
      parsed.snapshot.polarity = 'positive'
    if (typeof parsed.id !== 'string' || typeof parsed.definitionId !== 'string')
      return null
    if (!isSnapshot(parsed.snapshot) || !isAttachedTarget(parsed.attachedTo))
      return null
    if (!isLifecycle(parsed.lifecycle))
      return null
    if (typeof parsed.enabled !== 'boolean' || typeof parsed.attachedAtTurn !== 'number')
      return null
    if (
      parsed.turnsRemaining !== undefined
      && (typeof parsed.turnsRemaining !== 'number' || !Number.isFinite(parsed.turnsRemaining))
    ) {
      return null
    }
    if (parsed.note !== undefined && typeof parsed.note !== 'string')
      return null
    return parsed as unknown as BuffInstance
  }
  catch {
    return null
  }
}
