<script setup lang="ts">
import logoUrl from '@/assets/logo.png'

interface Props {
  size?: number
  subtle?: boolean
}
const { size = 16, subtle = false } = defineProps<Props>()
</script>

<template>
  <span
    class="inline-flex items-center justify-center leading-none"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      filter: subtle ? 'grayscale(1) brightness(1.2) opacity(0.75)' : undefined,
    }"
  >
    <img
      :src="logoUrl"
      :width="size"
      :height="size"
      class="block object-contain"
      draggable="false"
      alt=""
    >
  </span>
</template>
