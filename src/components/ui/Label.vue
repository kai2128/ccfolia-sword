<script setup lang="ts">
import { Label as LabelPrimitive } from 'reka-ui'
</script>

<template>
  <LabelPrimitive class="cursor-pointer select-none text-xs text-white/80 font-medium">
    <slot />
  </LabelPrimitive>
</template>
