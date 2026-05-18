// reka-ui 的 Popover/Dialog/Tooltip 等 outside-click 检测在 Shadow DOM 下失效:
// DismissableLayer 内部用 event.target 反查 trigger,但事件冒到 document 时 target 已被
// Shadow DOM 的事件 retargeting 改成 shadow host,trigger.contains(host) 永远 false → 点
// 已打开的 trigger 时,outside-click 先关、trigger 的 click 又开,视觉上点不动。
//
// 我们整个 app 跑在 createShadowMount 的 shadow root 里(见 src/infra/shadow-mount.ts),
// 用到 reka-ui Popover 的地方都中招。这个 composable 抽出统一修法:
//
//   <script setup>
//   import { useTemplateRef } from 'vue'
//   const triggerRef = useTemplateRef<{ $el: HTMLElement }>('trigger')
//   const { onPointerDownOutside } = useShadowPopoverTrigger(triggerRef)
//   </script>
//   <template>
//     <PopoverTrigger ref="trigger" as-child>...</PopoverTrigger>
//     <PopoverContent @pointer-down-outside="onPointerDownOutside">...</PopoverContent>
//   </template>
//
// composedPath() 穿透 shadow 边界拿真实 target,落在 trigger 内就 preventDefault,
// 让 trigger 的 click 走 reka-ui 原生 toggle(此时它看到的 open 还是 true → 关掉)。

import type { Ref } from 'vue'

type TriggerInstance = { $el: HTMLElement } | null
type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>

export function useShadowPopoverTrigger(triggerRef: Readonly<Ref<TriggerInstance>>) {
  function onPointerDownOutside(event: PointerDownOutsideEvent) {
    const triggerEl = triggerRef.value?.$el
    if (!triggerEl)
      return
    const path = event.detail.originalEvent.composedPath()
    for (const node of path) {
      if (node === triggerEl || (node instanceof Node && triggerEl.contains(node))) {
        event.preventDefault()
        return
      }
    }
  }

  return { onPointerDownOutside }
}
