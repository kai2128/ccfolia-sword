<script setup lang="ts">
// 通用 popconfirm:点 trigger 弹气泡问"确认/取消",和 NumberEdit / TagAttachPopover 同款 Reka 风格。
// trigger 走默认 slot + PopoverTrigger as-child,保留外部按钮原状。
//   bypass=true 时点击直接 emit confirm 不弹气泡,用来跳过"无需确认的快路径"。
// Shadow DOM 下 trigger toggle 失效问题统一走 useShadowPopoverTrigger composable。

import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, useTemplateRef } from 'vue'
import { useShadowPopoverTrigger } from '@/composables/useShadowPopoverTrigger'
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
const triggerRef = useTemplateRef<{ $el: HTMLElement }>('trigger')
const { onPointerDownOutside } = useShadowPopoverTrigger(triggerRef)

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
</script>

<template>
  <PopoverRoot :open="open" @update:open="onOpenChange">
    <PopoverTrigger ref="trigger" as-child>
      <slot />
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
