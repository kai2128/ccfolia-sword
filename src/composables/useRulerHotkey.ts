// 全局 M 切换测距、Esc 清空当前测量。
// R 被 ccfolia 旋转占用,M = Measure 且未被占用。焦点在输入框 / contenteditable 时放行。
// 注:app 跑在 shadow root 里,keydown 到 document 时 ev.target 会被 retarget 成 host,
// 用 composedPath()[0] 拿到 shadow 内真正的目标,才能正确识别我们面板里的输入框。
import { onMounted, onUnmounted } from 'vue'
import { useRulerStore } from '@/stores/ruler'

function isInTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useRulerHotkey(): void {
  let cleanup: (() => void) | null = null

  onMounted(() => {
    const store = useRulerStore()

    const handler = (ev: KeyboardEvent): void => {
      if (isInTextInput(ev.composedPath()[0] ?? ev.target))
        return

      if (ev.code === 'KeyM' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey) {
        ev.preventDefault()
        store.toggle()
      }
      else if (ev.key === 'Escape' && store.active) {
        store.clearAll() // 不 preventDefault:Escape 交还 ccfolia
      }
    }

    window.addEventListener('keydown', handler)
    cleanup = () => window.removeEventListener('keydown', handler)
  })

  onUnmounted(() => {
    cleanup?.()
    cleanup = null
  })
}
