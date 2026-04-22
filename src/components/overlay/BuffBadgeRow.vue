<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed } from 'vue'
import BuffIcon from '@/components/buffs/BuffIcon.vue'

const props = defineProps<{
  buffs: BuffInstance[]
  maxVisible?: number
}>()

const maxVisible = computed(() => props.maxVisible ?? 3)

const visibleBuffs = computed(() => {
  const enabled = props.buffs.filter(buff => buff.enabled)
  const disabled = props.buffs.filter(buff => !buff.enabled)
  return [...enabled, ...disabled].slice(0, maxVisible.value)
})

const overflow = computed(() => Math.max(0, props.buffs.length - maxVisible.value))

function pillClass(buff: BuffInstance): string {
  return buff.snapshot.polarity === 'positive'
    ? 'bg-buff/85 text-white border-buff'
    : 'bg-debuff/85 text-white border-debuff'
}
</script>

<template>
  <div class="pointer-events-none flex items-center gap-1">
    <span
      v-for="buff in visibleBuffs"
      :key="buff.id"
      class="inline-flex items-center gap-1 border rounded px-1.5 py-0.5 text-xs font-medium leading-none"
      :class="[pillClass(buff), { 'opacity-40 grayscale line-through': !buff.enabled }]"
      :title="buff.snapshot.description"
    >
      <BuffIcon :icon="buff.snapshot.icon" size-class="text-3.5" />
      <span>{{ buff.snapshot.name }}</span>
      <span v-if="buff.turnsRemaining !== undefined" class="opacity-80">{{ buff.turnsRemaining }}T</span>
    </span>
    <span
      v-if="overflow > 0"
      class="inline-flex items-center border rounded border-white/50 bg-black/50 px-1 py-px text-2.5 text-white leading-none"
    >⋯+{{ overflow }}</span>
  </div>
</template>
