<script setup lang="ts">
// 通用 popconfirm:点 trigger 弹气泡问"确认/取消",和 NumberEdit / TagAttachPopover 同款 Reka 风格。
// trigger 走默认 slot + PopoverTrigger as-child,保留外部按钮原状。
//   bypass=true 时点击直接 emit confirm 不弹气泡,用来跳过"无需确认的快路径"。
//
// Shadow DOM 适配:整个 app 跑在 createShadowMount 的 shadow root 里。reka-ui 的 outside-click
// 检测通过 detail.originalEvent.target 判断是否点在 trigger 上,但 Shadow DOM 的事件 retargeting
// 把 target 改成了 shadow host,trigger.contains(host) 永远 false → 再点 trigger 时 popover 关了又
// 立刻被 trigger 自己的 click 重开。这里拦截 PopoverContent 的 pointer-down-outside 事件,用
// composedPath() 穿透 shadow 边界拿真实 target,落在 trigger 内就 preventDefault,让 trigger toggle
// 走 reka-ui 原生路径。

import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref } from 'vue'
import { usePortalTarget } from './portal'

const props = withDefaults(
  defineProps<{
    message: string
    confirmText?: string
    cancelText?: string
    bypass?: boolean
  }>(),
  {
    confirmText: '确认',
    cancelText: '取消',
    bypass: false,
  },
)

const emit = defineEmits<{
  (e: 'confirm'): void
}>()

const open = ref(false)
const target = usePortalTarget()
// 包 slot 的 wrapper(display: contents 不占布局),用于 outside-click 时 composedPath 反查 trigger
const triggerRef = ref<HTMLElement | null>(null)

function onOpenChange(next: boolean) {
  if (next && props.bypass) {
    emit('confirm')
    return
  }
  open.value = next
}

function onConfirm() {
  open.value = false
  emit('confirm')
}

function onCancel() {
  open.value = false
}

type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>

function onPointerDownOutside(event: PointerDownOutsideEvent) {
  const wrapper = triggerRef.value
  if (!wrapper)
    return
  // composedPath 会穿透 shadow 边界,第一个就是真实 pointerdown target
  const path = event.detail.originalEvent.composedPath()
  for (const node of path) {
    if (node === wrapper || (node instanceof Node && wrapper.contains(node))) {
      event.preventDefault()
      return
    }
  }
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="onOpenChange">
    <PopoverTrigger as-child>
      <span ref="triggerRef" style="display: contents">
        <slot />
      </span>
    </PopoverTrigger>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        :side-offset="6"
        :collision-padding="8"
        class="z-30 max-w-60 flex flex-col gap-2 border border-white/15 rounded bg-surface p-2 text-white shadow-lg focus:outline-none"
        @pointer-down-outside="onPointerDownOutside"
      >
        <p class="text-xs text-white/85">
          {{ message }}
        </p>
        <div class="flex justify-end gap-1">
          <button
            type="button"
            class="h-6 rounded px-2 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            @click="onCancel"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="h-6 rounded bg-accent/80 px-2 text-[11px] text-white transition-colors hover:bg-accent"
            @click="onConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
