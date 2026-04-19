// BuffPayload · sword 自定义 buff 数据
// schema 完整定义见 docs/design/10-ccfolia-storage.md §BuffPayload schema。
// Phase 2 只用 minimal 子集跑通 params 写入;Phase 8 再补 modifiers / hooks。

export type BuffCategory = 'buff' | 'debuff' | 'neutral'

export type BuffLifecycle
  = | { kind: 'permanent' }
    | { kind: 'turns', remaining: number }
    | { kind: 'once', consumed: boolean }
    | { kind: 'manual' }

export interface BuffModifier {
  target: string // ModifierTarget — Phase 8 精化,现在用 string 占位
  value: number
}

export interface BuffPayload {
  v: 1
  id: string // uuid,和 label 里的 uuid 一致
  partId?: string
  name: string
  category: BuffCategory
  icon?: string
  color?: string
  description?: string
  lifecycle: BuffLifecycle
  modifiers: BuffModifier[]
  attachedAt: { round: number, timestamp: number }
  notes?: string
}

export const BUFF_LABEL_PREFIX = 'cs_buff_'

export function buffLabel(id: string): string {
  return `${BUFF_LABEL_PREFIX}${id}`
}

export function isBuffLabel(label: string): boolean {
  return label.startsWith(BUFF_LABEL_PREFIX)
}
