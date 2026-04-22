import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition, TagInstancePayload } from '@/types/tag'
import { parseTagLabel } from '@/types/tag'

export interface TagInstance {
  definitionId: string
  attachedAt: number
}

// 从 params 解出 tag 实例列表。坏 JSON 直接跳过,避免脏数据污染分组与显示。
export function readTagInstances(char: CcfoliaCharacter): TagInstance[] {
  const out: TagInstance[] = []
  for (const param of char.params) {
    const definitionId = parseTagLabel(param.label)
    if (!definitionId)
      continue

    let parsed: Partial<TagInstancePayload> | null = null
    try {
      parsed = JSON.parse(param.value) as Partial<TagInstancePayload>
    }
    catch {
      continue
    }

    if (!parsed || typeof parsed !== 'object')
      continue

    out.push({
      definitionId,
      attachedAt: typeof parsed.attachedAt === 'number' ? parsed.attachedAt : 0,
    })
  }
  return out
}

export function resolveTags(
  instances: TagInstance[],
  byId: (id: string) => TagDefinition | undefined,
): TagDefinition[] {
  const out: TagDefinition[] = []
  for (const instance of instances) {
    const definition = byId(instance.definitionId)
    if (definition)
      out.push(definition)
  }
  return out
}

export function sortByOrder(defs: TagDefinition[]): TagDefinition[] {
  return [...defs].sort((a, b) => {
    if (a.order !== b.order)
      return a.order - b.order
    return a.id.localeCompare(b.id)
  })
}

export function primaryTag(defs: TagDefinition[]): TagDefinition | null {
  if (defs.length === 0)
    return null
  return sortByOrder(defs)[0]
}
