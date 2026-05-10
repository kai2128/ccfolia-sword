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
        class="ccs-sheet-overlay fixed inset-0 bg-black/60"
      />
      <DialogContent
        class="ccs-sheet-content fixed right-0 top-0 h-full w-[min(95vw,34rem)] flex flex-col gap-3 border-y border-l border-white/10 rounded-l-md bg-surface p-4 text-white shadow-xl focus:outline-none"
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
@keyframes ccs-sheet-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes ccs-sheet-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes ccs-slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
@keyframes ccs-slide-out-right {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}
.ccs-sheet-overlay[data-state='open'] {
  animation: ccs-sheet-fade-in 120ms ease-out;
}
.ccs-sheet-overlay[data-state='closed'] {
  animation: ccs-sheet-fade-out 100ms ease-in;
}
.ccs-sheet-content[data-state='open'] {
  animation: ccs-slide-in-right 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ccs-sheet-content[data-state='closed'] {
  animation: ccs-slide-out-right 140ms ease-in;
}
</style>
