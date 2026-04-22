<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  variant?: 'solid' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
}>(), {
  variant: 'solid',
  size: 'md',
  disabled: false,
})

const attrs = useAttrs()

const base
  = 'inline-flex items-center justify-center gap-1 rounded font-medium select-none '
    + 'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent '
    + 'disabled:opacity-40 disabled:cursor-not-allowed'

const sizeCls = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'h-5 px-1 text-xs'
    case 'sm':
      return 'h-6 px-2 text-xs'
    case 'md':
    default:
      return 'h-8 px-3 text-sm'
  }
})

const variantCls = computed(() => {
  switch (props.variant) {
    case 'ghost': return 'bg-transparent text-white hover:bg-white/10'
    case 'danger': return 'bg-hp/80 text-white hover:bg-hp'
    case 'solid':
    default: return 'bg-accent/80 text-white hover:bg-accent'
  }
})
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :class="[base, sizeCls, variantCls]"
    v-bind="attrs"
  >
    <slot />
  </button>
</template>
