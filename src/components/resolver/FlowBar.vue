<script setup lang="ts">
import type { Resolution } from '@/core/resolver/types'
import { computed } from 'vue'

const props = defineProps<{
  resolution: Resolution
}>()

const emit = defineEmits<{
  scrollTo: [anchor: 'dice' | 'targets' | 'damage']
}>()

type StepKey = 'dice' | 'targets' | 'damage'

const steps = computed(() => {
  const { draft, targets } = props.resolution
  const attackReady = draft.kind === 'physical'
    ? draft.attackRoll !== undefined
    : draft.castingRoll !== undefined
  const targetsReady = draft.targets.length > 0 && draft.targets.every((target) => {
    return draft.kind === 'physical'
      ? target.evasion !== undefined
      : target.resistValue !== undefined
  })
  const damageReady = draft.targets.length > 0 && targets.every(target => target.finalDamage !== null)

  const items: Array<{ key: StepKey, label: string, done: boolean }> = [
    { key: 'dice', label: draft.kind === 'physical' ? '命中' : '行使', done: attackReady },
    { key: 'targets', label: draft.kind === 'physical' ? '回避' : '抵抗', done: targetsReady },
    { key: 'damage', label: '伤害', done: damageReady },
  ]

  let activeIndex = items.findIndex(item => !item.done)
  if (activeIndex < 0)
    activeIndex = items.length - 1

  return items.map((item, index) => ({
    ...item,
    active: index === activeIndex,
  }))
})
</script>

<template>
  <div class="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs">
    <template v-for="(step, index) in steps" :key="step.key">
      <button
        type="button"
        class="h-7 flex items-center gap-1 rounded px-2 transition-colors"
        :class="[
          step.active ? 'bg-accent/20 text-accent' : step.done ? 'text-white/80' : 'text-white/40',
        ]"
        @click="emit('scrollTo', step.key)"
      >
        <span v-if="step.done" class="i-lucide-check text-3" />
        <span v-else-if="step.active" class="i-lucide-circle-dot text-3" />
        <span v-else class="i-lucide-circle text-3" />
        {{ step.label }}
      </button>
      <span v-if="index < steps.length - 1" class="text-white/20">→</span>
    </template>
  </div>
</template>
