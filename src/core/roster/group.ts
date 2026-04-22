import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { primaryTag, readTagInstances, resolveTags } from '@/core/tag'

export interface RosterGroup {
  location: 'on-canvas' | 'off-canvas'
  primaryTagId: string | null
  primaryTag: TagDefinition | null
  chars: CcfoliaCharacter[]
}

export interface GroupArgs {
  chars: CcfoliaCharacter[]
  isOnCanvas: (charId: string) => boolean
  byTagId: (id: string) => TagDefinition | undefined
  onCanvasOnly: boolean
}

interface Bucket extends RosterGroup {
  primaryOrder: number
}

export function groupRoster(args: GroupArgs): RosterGroup[] {
  const { chars, isOnCanvas, byTagId, onCanvasOnly } = args
  const bucketMap = new Map<string, Bucket>()

  for (const char of chars) {
    const onCanvas = isOnCanvas(char._id)
    if (onCanvasOnly && !onCanvas)
      continue

    const location: RosterGroup['location'] = onCanvas ? 'on-canvas' : 'off-canvas'
    const resolved = resolveTags(readTagInstances(char), byTagId)
    const primary = primaryTag(resolved)
    const primaryTagId = primary?.id ?? null
    const primaryOrder = primary?.order ?? Number.POSITIVE_INFINITY
    const key = `${location}::${primaryTagId ?? '__none__'}`

    let bucket = bucketMap.get(key)
    if (!bucket) {
      bucket = {
        location,
        primaryOrder,
        primaryTagId,
        primaryTag: primary,
        chars: [],
      }
      bucketMap.set(key, bucket)
    }
    bucket.chars.push(char)
  }

  const groups = [...bucketMap.values()]
  groups.sort((a, b) => {
    if (a.location !== b.location)
      return a.location === 'on-canvas' ? -1 : 1
    if (a.primaryOrder !== b.primaryOrder)
      return a.primaryOrder - b.primaryOrder
    return (a.primaryTagId ?? '').localeCompare(b.primaryTagId ?? '')
  })

  for (const group of groups)
    group.chars.sort((a, b) => a.name.localeCompare(b.name))

  return groups.map(({ primaryOrder: _primaryOrder, ...group }) => group)
}
