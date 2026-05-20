<script setup lang="ts">
// roster 内联 selection mode 的 HP/MP 快捷:复用 HpMpPanel,套在 Popover 里。
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, useTemplateRef } from 'vue'
import HpMpPanel from '@/components/roster/batch-apply/HpMpPanel.vue'
import { usePortalTarget } from '@/components/ui'
import { useRosterSelectionActors } from '@/composables/useRosterSelectionActors'
import { useShadowPopoverTrigger } from '@/composables/useShadowPopoverTrigger'

const open = ref(false)
const target = usePortalTarget()
const triggerRef = useTemplateRef<{ $el: HTMLElement }>('trigger')
const { onPointerDownOutside } = useShadowPopoverTrigger(triggerRef)

const { selectedActors, selectedCount } = useRosterSelectionActors()
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger ref="trigger" as-child>
      <button
        type="button"
        class="h-6 flex items-center gap-1 border border-white/20 rounded bg-black/30 px-2 text-xs text-white/80 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-accent/20 hover:enabled:text-white"
        :disabled="selectedCount === 0"
        :title="selectedCount === 0 ? '先勾选角色' : `对 ${selectedCount} 个 part 调整 HP / MP`"
      >
        <span class="i-lucide-heart text-3" />
        HP/MP
        <span class="i-lucide-chevron-down text-3" />
      </button>
    </PopoverTrigger>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        :side-offset="4"
        :collision-padding="8"
        align="start"
        class="z-30 w-[min(90vw,22rem)] border border-white/15 rounded bg-surface p-3 text-white shadow-lg focus:outline-none"
        @pointer-down-outside="onPointerDownOutside"
      >
        <HpMpPanel
          :selected-actors="selectedActors"
          :selected-count="selectedCount"
          :sheet-open="open"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
