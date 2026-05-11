import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { primaryTag, readTagInstances, resolveTags } from '@/core/tag'

export interface RosterGroup {
  location: 'on-canvas' | 'off-canvas'
  primaryTagId: string | null
  primaryTag: TagDefinition | null
  chars: CcfoliaCharacter[]
}

export type RosterSortMode = 'name' | 'position'

export interface GroupArgs {
  chars: CcfoliaCharacter[]
  isOnCanvas: (charId: string) => boolean
  byTagId: (id: string) => TagDefinition | undefined
  onCanvasOnly: boolean
  // 仅显示板外。和 onCanvasOnly 互斥(调用方负责),两个都为 true 时本函数会返回空。
  offCanvasOnly?: boolean
  // 按名称子串过滤(大小写不敏感,去首尾空白)。空串/undefined = 不过滤。
  nameQuery?: string
  // 组内排序方式。默认 'name'(按角色名字典序)。'position' = 按 piece 坐标:
  // 先 y 升(画布上→下),再 x 升(画布左→右);无坐标的角色排到末尾,以名字 fallback。
  sortMode?: RosterSortMode
  // 'position' 排序需要的查询函数:返回该角色的 piece 中心坐标(px),无坐标返回 null。
  positionOf?: (charId: string) => { x: number, y: number } | null
}

interface Bucket extends RosterGroup {
  primaryOrder: number
}

export function groupRoster(args: GroupArgs): RosterGroup[] {
  const { chars, isOnCanvas, byTagId, onCanvasOnly, offCanvasOnly = false, nameQuery, sortMode = 'name', positionOf } = args
  const needle = (nameQuery ?? '').trim().toLowerCase()
  const bucketMap = new Map<string, Bucket>()

  for (const char of chars) {
    const onCanvas = isOnCanvas(char._id)
    if (onCanvasOnly && !onCanvas)
      continue
    if (offCanvasOnly && onCanvas)
      continue
    if (needle && !(char.name ?? '').toLowerCase().includes(needle))
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

  // sortMode='position':先 y 升、再 x 升;无坐标(positionOf 返回 null 或未提供)的角色
  // 排到该组末尾,组内 fallback 用名字字典序,避免顺序抖动。
  const byName = (a: CcfoliaCharacter, b: CcfoliaCharacter) => a.name.localeCompare(b.name)
  for (const group of groups) {
    if (sortMode === 'position' && positionOf) {
      group.chars.sort((a, b) => {
        const pa = positionOf(a._id)
        const pb = positionOf(b._id)
        if (pa && pb) {
          if (pa.y !== pb.y)
            return pa.y - pb.y
          if (pa.x !== pb.x)
            return pa.x - pb.x
          return byName(a, b)
        }
        if (pa)
          return -1
        if (pb)
          return 1
        return byName(a, b)
      })
    }
    else {
      group.chars.sort(byName)
    }
  }

  return groups.map(({ primaryOrder: _primaryOrder, ...group }) => group)
}
