<script setup lang="ts">
// Roster row 的「更多操作」溢出菜单。视觉与 TagAttachPopover / PopConfirm 同源。
// 菜单内容由父行通过默认 slot 提供 —— 这样像「移除角色」这种需要 PopConfirm 二次确认的项,
// 父行可以把 <PopConfirm><button>…</button></PopConfirm> 直接当 slot 子节点放进来,无须本组件耦合业务逻辑。
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref } from 'vue'
import { usePortalTarget } from '@/components/ui'

const open = ref(false)
const target = usePortalTarget()
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white"
        title="更多"
      >
        <span class="i-lucide-more-vertical text-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        align="end"
        :side-offset="6"
        :collision-padding="8"
        class="z-30 min-w-40 flex flex-col gap-0.5 border border-white/15 rounded bg-surface p-1 text-white shadow-lg focus:outline-none"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
