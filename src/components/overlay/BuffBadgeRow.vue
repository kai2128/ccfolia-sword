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
</script>

<template>
  <div class="pointer-events-none flex items-center gap-0.5">
    <span
      v-for="buff in visibleBuffs"
      :key="buff.id"
      class="inline-flex items-center gap-0.5 border border-white/50 rounded bg-black/50 px-1 py-px text-3 text-white leading-none"
      :class="{ 'opacity-45 grayscale': !buff.enabled }"
      :style="buff.snapshot.color ? { borderColor: buff.snapshot.color } : undefined"
      :title="buff.snapshot.name"
    >
      <span v-if="!buff.enabled" class="text-2.5">⊘</span>
      <BuffIcon :icon="buff.snapshot.icon" size-class="text-xs" />
    </span>
    <span
      v-if="overflow > 0"
      class="inline-flex items-center border border-white/50 rounded bg-black/50 px-1 py-px text-2.5 text-white leading-none"
    >⋯+{{ overflow }}</span>
  </div>
</template>
