<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  // hp = 绿(capsule 生命色)、mp = 蓝(capsule 法力色)、success = 翠绿(增益动作)
  variant?: 'solid' | 'ghost' | 'danger' | 'success' | 'hp' | 'mp'
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
  loading?: boolean
}>(), {
  variant: 'solid',
  size: 'md',
  disabled: false,
  loading: false,
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
    case 'success': return 'bg-emerald-600 text-white hover:bg-emerald-500'
    case 'hp': return 'bg-capsule-hp-2 text-white hover:brightness-110'
    case 'mp': return 'bg-capsule-mp-2 text-white hover:brightness-110'
    case 'solid':
    default: return 'bg-accent/80 text-white hover:bg-accent'
  }
})
</script>

<template>
  <button
    type="button"
    :disabled="disabled || loading"
    :class="[base, sizeCls, variantCls]"
    v-bind="attrs"
  >
    <span v-if="loading" class="i-lucide-loader-2 animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
