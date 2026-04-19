// StatusEffect 模型,对齐 REQUIREMENTS §7
// Definition 是库里的"模板",挂到角色上后展开为 cs_buff_* param(见 types/buff.ts BuffPayload)
// Instance 是运行时从 params 解析出的形态(combat 逻辑用)

import type { BuffCategory, BuffLifecycle } from './buff'
import type { Modifier } from './modifier'

export type StatusEffectHookTrigger
  = | 'turn-start'
    | 'turn-end'
    | 'round-start'
    | 'round-end'
    | 'on-attach'
    | 'on-detach'

export interface StatusEffectHook {
  trigger: StatusEffectHookTrigger
  prompt: string // "请掷中毒伤害 1d6" —— 只提示,GM 决定
}

export interface StatusEffectDefinition {
  id: string
  name: string
  category: BuffCategory
  icon?: string
  color?: string
  description?: string
  defaultLifecycle: BuffLifecycle
  bundledModifiers: Omit<Modifier, 'id' | 'lifecycle'>[] // lifecycle 跟随 buff 统一;id 挂载时生成
  hooks: StatusEffectHook[]
  builtin?: boolean // true = sword 内置库,不可删改
}

export interface StatusEffectInstance {
  id: string // = cs_buff_<uuid> 里的 uuid
  definitionId?: string // 若从 library 派生则指回定义;GM 自定义挂载可为空
  name: string
  category: BuffCategory
  icon?: string
  description?: string
  lifecycle: BuffLifecycle
  modifiers: Modifier[]
  attachedAtRound: number
  attachedAtTimestamp: number
}
