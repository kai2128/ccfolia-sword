// pointer 事件拖拽 — 只改 translate,不改 left/top,避免频繁 reflow。
// 父组件把 handleRef 绑到标题栏,targetRef 绑到被拖动的容器。
// 位置由传入的 getter/setter 接管,这样就能直接 hook 到 settings store。

import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted } from 'vue'

export interface DraggableOptions {
  handleRef: Ref<HTMLElement | null>
  targetRef: Ref<HTMLElement | null>
  getPos: () => { x: number, y: number }
  // size 是拖动时测到的真实 rect 尺寸;store 里的二次 clamp 需要它,
  // 不然折叠态会按默认 360 收紧,把拖动范围砍到视口中段。
  setPos: (pos: { x: number, y: number }, size: { width: number, height: number }) => void
}

export function useDraggable(opts: DraggableOptions) {
  let startX = 0
  let startY = 0
  let originX = 0
  let originY = 0
  let dragging = false

  function clamp(x: number, y: number, w: number, h: number) {
    const maxX = Math.max(0, window.innerWidth - w)
    const maxY = Math.max(0, window.innerHeight - h)
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    }
  }

  function onPointerDown(e: PointerEvent) {
    const handle = opts.handleRef.value
    const target = opts.targetRef.value
    if (!handle || !target)
      return
    // 排除标题栏里按钮 / input 等可交互元素
    if ((e.target as HTMLElement).closest('button,input,select,a'))
      return
    dragging = true
    const pos = opts.getPos()
    startX = e.clientX
    startY = e.clientY
    originX = pos.x
    originY = pos.y
    handle.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging)
      return
    const target = opts.targetRef.value
    if (!target)
      return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const rect = target.getBoundingClientRect()
    const next = clamp(originX + dx, originY + dy, rect.width, rect.height)
    opts.setPos(next, { width: rect.width, height: rect.height })
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging)
      return
    dragging = false
    opts.handleRef.value?.releasePointerCapture(e.pointerId)
  }

  onMounted(() => {
    const handle = opts.handleRef.value
    if (!handle)
      return
    handle.addEventListener('pointerdown', onPointerDown)
    handle.addEventListener('pointermove', onPointerMove)
    handle.addEventListener('pointerup', onPointerUp)
    handle.addEventListener('pointercancel', onPointerUp)
  })

  onBeforeUnmount(() => {
    const handle = opts.handleRef.value
    if (!handle)
      return
    handle.removeEventListener('pointerdown', onPointerDown)
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
    handle.removeEventListener('pointercancel', onPointerUp)
  })
}
