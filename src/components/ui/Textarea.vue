<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>()
const attrs = useAttrs()
</script>

<template>
  <textarea
    v-model="model"
    class="w-full resize-y border border-white/20 rounded bg-black/30 px-2 py-1.5 text-sm text-white disabled:cursor-not-allowed focus:border-accent placeholder:text-white/40 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
    v-bind="attrs"
  />
</template>
