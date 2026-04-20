<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  id?: string
  disabled?: boolean
}>()

const model = defineModel<boolean>()
</script>

<template>
  <SwitchRoot
    :id="id"
    v-model="model"
    :disabled="disabled"
    class="relative h-4 w-7 rounded-full bg-white/20 transition-colors disabled:cursor-not-allowed data-[state=checked]:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  >
    <SwitchThumb
      class="absolute left-0 top-0.5 h-3 w-3 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-3.5"
    />
  </SwitchRoot>
</template>
