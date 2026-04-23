import type { BuffPolarity, BuffSnapshot, StatusEffectDefinition } from '@/types/buff-v3'
import { toFiniteOrUndef } from './coerce'

export interface BuffFormState {
  name: string
  description: string
  turnsRemaining: number | ''
  polarity: BuffPolarity
  icon: string
  actionValue: number | ''
}

export const EMPTY_BUFF_FORM: BuffFormState = {
  name: '',
  description: '',
  turnsRemaining: '',
  polarity: 'positive',
  icon: '',
  actionValue: '',
}

export interface NormalizedBuffForm {
  name: string
  description: string
  icon: string
  polarity: BuffPolarity
  turnsRemaining: number | undefined
  actionValue: number | undefined
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
    actionValue: toFiniteOrUndef(form.actionValue),
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
    actionValue: n.actionValue,
  }
}

// 简化 form 只覆盖 name/description/icon/polarity/turnsRemaining。
// def/snapshot 上的 color/tickPrompt/reminder/defaultAoeRadius/modifiers/scope 不在 form 里;
// 编辑路径若需保留这些字段,必须由 caller merge 回旧对象
// (见 ccfolia/writers/update-buff-snapshot.ts 的 applyBuffSnapshotPatch)。
export function definitionToForm(def: StatusEffectDefinition): BuffFormState {
  return {
    name: def.name,
    description: def.description,
    turnsRemaining: def.defaultDuration ?? '',
    polarity: def.polarity,
    icon: def.icon,
    actionValue: def.actionValue ?? '',
  }
}

export function instanceToForm(snapshot: BuffSnapshot, turnsRemaining: number | undefined): BuffFormState {
  return {
    name: snapshot.name,
    description: snapshot.description,
    turnsRemaining: turnsRemaining ?? '',
    polarity: snapshot.polarity,
    icon: snapshot.icon,
    actionValue: snapshot.actionValue ?? '',
  }
}
