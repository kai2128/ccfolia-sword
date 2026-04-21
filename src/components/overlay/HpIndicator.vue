<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  max: number
  mpCurrent?: number
  mpMax?: number
}>()

function pct(cur: number, max: number): number {
  if (max <= 0)
    return 0
  return Math.max(0, Math.min(100, (cur / max) * 100))
}

const hpPct = computed(() => pct(props.current, props.max))
const mpPct = computed(() =>
  props.mpCurrent != null && props.mpMax != null ? pct(props.mpCurrent, props.mpMax) : 0,
)
const showMp = computed(() => props.mpCurrent != null && props.mpMax != null && props.mpMax > 0)

const isCritical = computed(() => props.current <= 0)
</script>

<template>
  <div class="ccs-hp-pill" :class="{ critical: isCritical }">
    <div class="bar hp">
      <div class="fill" :style="{ width: `${hpPct}%` }" />
    </div>
    <div v-if="showMp" class="bar mp">
      <div class="fill" :style="{ width: `${mpPct}%` }" />
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
.bar.mp {
  height: 4px;
  margin-top: 2px;
}
.fill {
  height: 100%;
  background: #4caf50;
  transition: width 120ms linear;
}
.bar.mp .fill {
  background: #3f8cff;
}
.critical .bar.hp .fill {
  background: #f44336;
}
.text {
  text-align: center;
  font-size: 11px;
  line-height: 1.2;
  margin-top: 1px;
}
</style>
