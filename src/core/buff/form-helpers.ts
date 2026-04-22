import type { BuffPolarity, BuffSnapshot, StatusEffectDefinition } from '@/types/buff-v3'
import { toFiniteOrUndef } from './coerce'

export interface BuffFormState {
  name: string
  description: string
  turnsRemaining: number | ''
  polarity: BuffPolarity
  icon: string
}

export const EMPTY_BUFF_FORM: BuffFormState = {
  name: '',
  description: '',
  turnsRemaining: '',
  polarity: 'positive',
  icon: '',
}

export interface NormalizedBuffForm {
  name: string
  description: string
  icon: string
  polarity: BuffPolarity
  turnsRemaining: number | undefined
}

export function normalizeBuffForm(form: BuffFormState): NormalizedBuffForm {
  const name = form.name.trim()
  const description = form.description.trim()
  if (!name)
    throw new Error('名字不能为空')
  if (!description)
    throw new Error('描述不能为空')
  const icon = form.icon.trim() || 'i-mdi-star'
  return {
    name,
    description,
    icon,
    polarity: form.polarity,
    turnsRemaining: toFiniteOrUndef(form.turnsRemaining),
  }
}

export function deriveLifecycle(turnsRemaining: number | undefined): 'encounter' | 'persistent' {
  return turnsRemaining !== undefined ? 'encounter' : 'persistent'
}

export function buildDefinition(id: string, n: NormalizedBuffForm): StatusEffectDefinition {
  return {
    id,
    name: n.name,
    icon: n.icon,
    description: n.description,
    polarity: n.polarity,
    scope: 'single',
    modifiers: [],
    builtin: false,
    defaultDuration: n.turnsRemaining,
  }
}

export function definitionToForm(def: StatusEffectDefinition): BuffFormState {
  return {
    name: def.name,
    description: def.description,
    turnsRemaining: def.defaultDuration ?? '',
    polarity: def.polarity,
    icon: def.icon,
  }
}

export function instanceToForm(snapshot: BuffSnapshot, turnsRemaining: number | undefined): BuffFormState {
  return {
    name: snapshot.name,
    description: snapshot.description,
    turnsRemaining: turnsRemaining ?? '',
    polarity: snapshot.polarity,
    icon: snapshot.icon,
  }
}
