<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

defineProps<{
  id?: string
  disabled?: boolean
}>()

const model = defineModel<boolean | 'indeterminate'>()
</script>

<template>
  <CheckboxRoot
    :id="id"
    v-model="model"
    :disabled="disabled"
    class="h-4 w-4 flex items-center justify-center border border-white/30 rounded-sm bg-black/30 disabled:cursor-not-allowed data-[state=checked]:border-accent data-[state=indeterminate]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:bg-accent/60 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  >
    <CheckboxIndicator class="text-white">
      <div v-if="model === 'indeterminate'" class="i-lucide-minus text-3" />
      <div v-else class="i-lucide-check text-3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
