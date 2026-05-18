import type { CharacterPartView } from '@/core/character/parts'
import type { CcfoliaCharacter } from '@/types/ccfolia'

export interface SelectedActor {
  ref: string
  char: CcfoliaCharacter
  // null = 角色无 status(退化场景),HP/MP/Buff 跳过
  part: CharacterPartView | null
}

// busy 用 progress 表达:null = idle, { done, total } = 正在跑
export interface BatchProgress { done: number, total: number }

export function btnLabel(base: string, count: number, progress: BatchProgress | null): string {
  if (!progress)
    return `${base} (${count})`
  return `${base}中 ${progress.done}/${progress.total}`
}
