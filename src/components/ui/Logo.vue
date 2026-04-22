<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  size?: number
  subtle?: boolean
}
const { size = 16, subtle = false } = defineProps<Props>()

const LOGO_URL = 'https://i.imgur.com/M5ZRBm4.png'

// 模块级单例:首次挂载触发一次探测,所有 <Logo> 实例共享结果
type State = 'pending' | 'ok' | 'failed'
const state = moduleState()

function moduleState() {
  const s = ref<State>('pending')
  const probe = new Image()
  probe.onload = () => (s.value = 'ok')
  probe.onerror = () => (s.value = 'failed')
  probe.src = LOGO_URL
  return s
}
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
      v-if="state === 'ok'"
      :src="LOGO_URL"
      :width="size"
      :height="size"
      class="block object-contain"
      draggable="false"
      alt=""
    >
    <div
      v-else-if="state === 'failed'"
      class="i-lucide-sword"
      :style="{ fontSize: `${size}px` }"
    />
  </span>
</template>
