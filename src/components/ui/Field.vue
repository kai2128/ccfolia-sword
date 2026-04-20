<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  label?: string
  error?: string | null
  hint?: string
}>()

const id = useId()
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="id" class="text-xs text-white/80 font-medium">
      {{ label }}
    </label>
    <slot :id="id" />
    <p v-if="error" class="text-xs text-hp">
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-xs text-white/40">
      {{ hint }}
    </p>
  </div>
</template>
