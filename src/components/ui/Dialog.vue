<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { usePortalTarget } from './portal'

defineProps<{
  title?: string
  description?: string
}>()

const open = defineModel<boolean>('open', { required: true })
// Shadow DOM 专属挂载点;没拿到就 fallback 到 body(开发态兜底,生产应永远有)
const target = usePortalTarget()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>

    <DialogPortal :to="target ?? undefined">
      <DialogOverlay
        class="ccs-dialog-overlay fixed inset-0 bg-black/60"
      />
      <DialogContent
        class="ccs-dialog-content fixed left-1/2 top-1/2 max-h-[85vh] w-[min(90vw,24rem)] flex flex-col gap-3 border border-white/10 rounded-md bg-surface p-4 text-white shadow-xl -translate-x-1/2 -translate-y-1/2 focus:outline-none"
      >
        <DialogTitle v-if="title" class="text-sm font-semibold">
          {{ title }}
        </DialogTitle>
        <DialogDescription v-if="description" class="text-xs text-white/60">
          {{ description }}
        </DialogDescription>

        <slot />

        <DialogClose
          class="absolute right-2 top-2 h-6 w-6 flex items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="关闭"
        >
          <div class="i-lucide-x text-4" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* 不加 scoped:Shadow DOM 自身已是样式边界,scoped attr 反而被 reka 的 data-state 工具类噪声干扰 */
@keyframes ccs-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes ccs-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes ccs-pop-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes ccs-pop-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.96);
  }
}
.ccs-dialog-overlay[data-state='open'] {
  animation: ccs-fade-in 120ms ease-out;
}
.ccs-dialog-overlay[data-state='closed'] {
  animation: ccs-fade-out 100ms ease-in;
}
.ccs-dialog-content[data-state='open'] {
  animation: ccs-pop-in 140ms ease-out;
}
.ccs-dialog-content[data-state='closed'] {
  animation: ccs-pop-out 100ms ease-in;
}
</style>
