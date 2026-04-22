<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon: string
  sizeClass?: string
}>()

const isUnoIcon = computed(() => props.icon.startsWith('i-'))
</script>

<template>
  <span
    v-if="isUnoIcon"
    class="inline-block"
    :class="[icon, sizeClass ?? 'text-sm']"
    aria-hidden="true"
  />
  <span v-else class="inline-block leading-none" :class="sizeClass ?? 'text-sm'">{{ icon }}</span>
</template>
