import type { CcfoliaCharacter } from '@/types/ccfolia'
import { defineStore } from 'pinia'
import { useRoomCharactersStore } from './room-characters-store'

// pieces 语义视图。ccfolia 没有独立 pieces slice —— character 即 piece。
// 这里只把坐标/尺寸等"画布关注"的字段拎出来,让后续 plan 的 scene 层 API 稳。
export interface PieceSnapshot {
  characterId: string
  x: number // px, 立绘中心
  y: number // px, 立绘中心
  widthCells: number // 立绘宽度(格)
  heightCells: number // 立绘高度(格)
  z: number
  angle: number
  invisible: boolean
  hideStatus: boolean
}

export function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

export function toPieceSnapshots(chars: CcfoliaCharacter[]): PieceSnapshot[] {
  const out: PieceSnapshot[] = []
  for (const c of chars) {
    if (typeof c.x !== 'number' || typeof c.y !== 'number')
      continue
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y))
      continue
    out.push({
      characterId: c._id,
      x: c.x,
      y: c.y,
      widthCells: num(c.width, 1),
      heightCells: num(c.height, 1),
      z: num(c.z, 0),
      angle: num(c.angle, 0),
      invisible: bool(c.invisible, false),
      hideStatus: bool(c.hideStatus, false),
    })
  }
  return out
}

export const usePiecesStore = defineStore('pieces', {
  getters: {
    list(): PieceSnapshot[] {
      return toPieceSnapshots(useRoomCharactersStore().all)
    },
    // id → snapshot 索引,随 list 反应性缓存。byCharacterId 由此走 O(1),
    // 避免 FxLayer / aoe 覆盖计算里逐次线性 find。
    byIdMap(): Map<string, PieceSnapshot> {
      const map = new Map<string, PieceSnapshot>()
      for (const p of this.list)
        map.set(p.characterId, p)
      return map
    },
    byCharacterId(): (characterId: string) => PieceSnapshot | undefined {
      return characterId => this.byIdMap.get(characterId)
    },
  },
})
