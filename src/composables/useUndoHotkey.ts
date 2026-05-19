// 全局 Ctrl+` / Ctrl+Shift+` 钩子。
// 用 Backquote 物理键避开 ccfolia 原生 Ctrl/Cmd+Z;Cmd+` 在 macOS 是系统切窗口,
// 这里只接 Ctrl,Mac 用户同样按 Ctrl+`。焦点在输入框时放行。

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
  if (!ev.ctrlKey)
    return null
  if (ev.altKey || ev.metaKey)
    return null
  // Backquote 是 ` 键的物理标识,跨键盘布局稳定。
  if (ev.code !== 'Backquote')
    return null
  return ev.shiftKey ? 'redo' : 'undo'
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

      ev.preventDefault()

      if (intent === 'undo')
        void store.undo()
      else
        void store.redo()
    }

    window.addEventListener('keydown', handler)
    cleanup = () => window.removeEventListener('keydown', handler)
  })

  onUnmounted(() => {
    cleanup?.()
    cleanup = null
  })
}
