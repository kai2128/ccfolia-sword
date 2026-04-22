// Tag 定义: 类别标签,目前只用于排序/分组展示,不参与战斗结算。
// 与 buff 不同,tag 没有 snapshot,改库后直接跟进最新显示。
export interface TagDefinition {
  id: string
  label: string
  color: string
  icon?: string
  order: number
  builtin: boolean
}

// params value 里存的运行时 payload。
export interface TagInstancePayload {
  attachedAt: number
}

export const TAG_LABEL_PREFIX = 'cs_tag_'
export const BUILTIN_TAG_PREFIX = 'builtin.'
export const CUSTOM_TAG_PREFIX = 'custom.'

export function tagLabel(definitionId: string): string {
  return `${TAG_LABEL_PREFIX}${definitionId}`
}

export function isTagLabel(label: string): boolean {
  return label.startsWith(TAG_LABEL_PREFIX)
}

export function parseTagLabel(label: string): string | null {
  if (!isTagLabel(label))
    return null
  return label.slice(TAG_LABEL_PREFIX.length)
}

export function isBuiltinTagId(id: string): boolean {
  return id.startsWith(BUILTIN_TAG_PREFIX)
}
