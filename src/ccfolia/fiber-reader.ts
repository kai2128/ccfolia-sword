// React Fiber 入口:从 DOM 节点挂的 __reactFiber* 属性向上走,
// 找到承载 character 数据的组件,然后从 hooks 链里取出 character。
//
// ccfolia v1.34.2 的结构(2026-04 实测):
//   .movable → ... → <Cq uid roomId characterId> (hasState)
//   Cq 的 memoizedState(hooks 单链表)某一格 memoizedState 形如:
//     { character, cellSize, scale, hasEditableRole, disabled }
//   这是一个 useSyncExternalStore,随 Firestore 变化自动更新。
//
// 本文件是全项目唯一允许使用 any 的地方(见 docs/design/05-language.md)。

import type { CcfoliaCharacter } from '@/types/ccfolia'

type FiberNode = any

function getFiber(el: Element): FiberNode | null {
  const key = Object.keys(el).find(k => k.startsWith('__reactFiber'))
  if (!key)
    return null
  return (el as unknown as Record<string, FiberNode>)[key] ?? null
}

// 在 hooks 链上找第一个 memoizedState.character 形如完整角色对象的槽位。
// hook 索引不稳定(ccfolia 升级时会变),所以按形状匹配而非固定下标。
function findCharacterInHooks(fiber: FiberNode): CcfoliaCharacter | null {
  let hook: FiberNode = fiber.memoizedState
  let guard = 0
  while (hook && guard < 64) {
    const s = hook.memoizedState
    const char = s && typeof s === 'object' ? s.character : null
    if (char && typeof char._id === 'string' && typeof char.name === 'string')
      return char as CcfoliaCharacter
    hook = hook.next
    guard++
  }
  return null
}

// 向上走,直到命中一个 props 里带 characterId 的组件,然后读它的 hooks。
// 旧兜底:如果哪天 ccfolia 又把 character 直接写回 props(或 hook 形状变),
// 再顺手扫一下 memoizedProps.character。
function walkUpForCharacter(start: FiberNode): CcfoliaCharacter | null {
  let fiber: FiberNode = start
  let guard = 0
  while (fiber && guard < 80) {
    const props = fiber.memoizedProps
    if (props && typeof props === 'object') {
      // 旧路径(docs/design/10 写的那个):props.character 直接存在
      const directChar = props.character
      if (directChar && typeof directChar._id === 'string')
        return directChar as CcfoliaCharacter
      // 新路径(v1.34.2):props.characterId + hooks.memoizedState.character
      if (typeof props.characterId === 'string') {
        const fromHook = findCharacterInHooks(fiber)
        if (fromHook)
          return fromHook
      }
    }
    fiber = fiber.return
    guard++
  }
  return null
}

export function getCharacterFromElement(el: Element): CcfoliaCharacter | null {
  const fiber = getFiber(el)
  if (!fiber)
    return null
  return walkUpForCharacter(fiber)
}

// ccfolia 的 token(桌面立绘)DOM 统一带 `.movable`。
// 如果未来 ccfolia 改了类名,加 fallback:scanRoomFallback()。
export function getAllCharactersInRoom(): CcfoliaCharacter[] {
  const seen = new Set<string>()
  const out: CcfoliaCharacter[] = []
  for (const el of document.querySelectorAll('.movable')) {
    const char = getCharacterFromElement(el)
    if (char && !seen.has(char._id)) {
      seen.add(char._id)
      out.push(char)
    }
  }
  return out
}

// 兜底:遍历整个 document,扫所有带 reactFiber 的节点。
// 慢,只在 .movable 零命中时调一次,用于确认选择器失效。
export function scanRoomFallback(): CcfoliaCharacter[] {
  const seen = new Set<string>()
  const out: CcfoliaCharacter[] = []
  for (const el of document.querySelectorAll('*')) {
    const char = getCharacterFromElement(el)
    if (char && !seen.has(char._id)) {
      seen.add(char._id)
      out.push(char)
    }
  }
  return out
}
