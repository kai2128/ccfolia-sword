// 全局 Ctrl/Cmd+Z 钩子。冲突策略:
//   - 我们的 undoStack 非空 -> capture 阶段 stopImmediatePropagation,自己处理
//   - 栈空 -> 不动,事件继续冒泡到 ccfolia 自己的 document 监听器
//   - 焦点在 input/textarea/contenteditable -> 不动,让浏览器原生输入框 undo 接管
//
// 用 capture 阶段(window 优先于 document)抢在 ccfolia 之前判断,
// 不复用 src/core/shell/hotkey.ts 因为那里是 bubbling + 无条件 preventDefault,
// 与"按需放行"语义不合,硬塞 flag 反而更乱。

import { onMounted, onUnmounted } from 'vue'
import { useUndoHistoryStore } from '@/stores/undo-history'

function isInTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA')
    return true
  if (target.isContentEditable)
    return true
  return false
}

type Intent = 'undo' | 'redo' | null

function resolveIntent(ev: KeyboardEvent): Intent {
  const isMod = ev.metaKey || ev.ctrlKey
  if (!isMod)
    return null
  const key = ev.key.toLowerCase()
  if (key === 'z')
    return ev.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !ev.shiftKey)
    return 'redo'
  return null
}

export function useUndoHotkey(): void {
  let cleanup: (() => void) | null = null

  onMounted(() => {
    const store = useUndoHistoryStore()

    const handler = (ev: KeyboardEvent): void => {
      const intent = resolveIntent(ev)
      if (!intent)
        return
      if (isInTextInput(ev.target))
        return

      const stackLen = intent === 'undo' ? store.undoStack.length : store.redoStack.length
      if (stackLen === 0)
        return

      ev.preventDefault()
      ev.stopImmediatePropagation()
      ev.stopPropagation()

      if (intent === 'undo')
        void store.undo()
      else
        void store.redo()
    }

    window.addEventListener('keydown', handler, { capture: true })
    cleanup = () => window.removeEventListener('keydown', handler, { capture: true })
  })

  onUnmounted(() => {
    cleanup?.()
    cleanup = null
  })
}
