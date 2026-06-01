<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { ref, useTemplateRef } from 'vue'
import { usePortalTarget } from '@/components/ui'
import { useShadowPopoverTrigger } from '@/composables/useShadowPopoverTrigger'
import AoeManager from './AoeManager.vue'

defineProps<{ characterId: string }>()

const open = ref(false)
const target = usePortalTarget()
const triggerRef = useTemplateRef<{ $el: HTMLElement }>('trigger')
const { onPointerDownOutside } = useShadowPopoverTrigger(triggerRef)

function openMenu() {
  open.value = true
}
defineExpose({ openMenu })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor ref="trigger" as-child>
      <slot />
    </PopoverAnchor>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        :side-offset="4"
        :collision-padding="8"
        align="end"
        class="z-30 w-56 border border-white/15 rounded bg-surface p-2 text-white shadow-lg focus:outline-none"
        @pointer-down-outside="onPointerDownOutside"
      >
        <AoeManager :character-id="characterId" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
