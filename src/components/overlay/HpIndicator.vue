<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  max: number
}>()

const pct = computed(() => {
  if (props.max <= 0)
    return 0
  return Math.max(0, Math.min(100, (props.current / props.max) * 100))
})

const isCritical = computed(() => props.current <= 0)
</script>

<template>
  <div class="ccs-hp-pill" :class="{ critical: isCritical }">
    <div class="bar">
      <div class="fill" :style="{ width: `${pct}%` }" />
    </div>
    <div class="text">
      {{ current }}/{{ max }}
    </div>
  </div>
</template>

<style scoped>
.ccs-hp-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 56px;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 4px;
  font-family: system-ui, sans-serif;
  color: #fff;
  pointer-events: none;
}
.bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: #4caf50;
  transition: width 120ms linear;
}
.critical .fill {
  background: #f44336;
}
.text {
  text-align: center;
  font-size: 11px;
  line-height: 1.2;
  margin-top: 1px;
}
</style>
