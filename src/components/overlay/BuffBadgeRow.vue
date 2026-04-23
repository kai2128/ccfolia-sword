<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed } from 'vue'
import BuffIcon from '@/components/buffs/BuffIcon.vue'

const props = defineProps<{
  buffs: BuffInstance[]
  pieceWidth?: number
}>()

// piece 太窄(<32px)直接整行不渲染。pill 边长按 ~14% piece 宽,clamp 到 [8, 14]px。
const HIDE_BELOW_PX = 32

const pieceWidth = computed(() => props.pieceWidth ?? 50)

// 0.14 × piece 宽,clamp 到 [5, 8]px。小 piece(<HIDE_BELOW_PX)在下面会整行隐藏。
const pillPx = computed(() => Math.max(5, Math.min(8, Math.round(pieceWidth.value * 0.14))))
// icon 在 pill 内留 1px 边
const iconPx = computed(() => Math.max(4, pillPx.value - 1))

// 一行最多放多少 pill,按 piece 宽度算(留 4px 给 overflow chip)。最少 1。
const maxVisible = computed(() => {
  if (pieceWidth.value < HIDE_BELOW_PX)
    return 0
  const room = pieceWidth.value - 6
  const slot = pillPx.value + 2
  return Math.max(1, Math.floor(room / slot))
})

const sortedBuffs = computed(() => {
  const enabled = props.buffs.filter(buff => buff.enabled)
  const disabled = props.buffs.filter(buff => !buff.enabled)
  return [...enabled, ...disabled]
})

const visibleBuffs = computed(() => sortedBuffs.value.slice(0, maxVisible.value))
const overflow = computed(() => Math.max(0, props.buffs.length - visibleBuffs.value.length))

function pillClass(buff: BuffInstance): string {
  const polarity = buff.snapshot.polarity === 'positive'
    ? 'bg-buff/85 text-white border-buff'
    : 'bg-debuff/85 text-white border-debuff'
  // AoE 覆盖徽章用虚线描边,和挂在自己身上的单体 buff 视觉区分
  const shape = buff.attachedTo.kind === 'aoe' ? 'border-dashed' : ''
  return `${polarity} ${shape}`
}

function pillTitle(buff: BuffInstance): string {
  const prefix = buff.attachedTo.kind === 'aoe' ? '[AoE] ' : ''
  const actionValue = buff.snapshot.actionValue !== undefined ? ` (${buff.snapshot.actionValue})` : ''
  const turns = buff.turnsRemaining !== undefined ? ` · ${buff.turnsRemaining}T` : ''
  const desc = buff.snapshot.description ? `\n${buff.snapshot.description}` : ''
  return `${prefix}${buff.snapshot.name}${actionValue}${turns}${desc}`
}
</script>

<template>
  <div v-if="maxVisible > 0" class="pointer-events-none flex items-center gap-0.5">
    <span
      v-for="buff in visibleBuffs"
      :key="buff.id"
      class="inline-flex shrink-0 items-center justify-center border rounded leading-none"
      :style="{ width: `${pillPx}px`, height: `${pillPx}px` }"
      :class="[pillClass(buff), { 'opacity-40 grayscale': !buff.enabled }]"
      :title="pillTitle(buff)"
    >
      <BuffIcon :icon="buff.snapshot.icon" :style="{ fontSize: `${iconPx}px` }" />
    </span>
    <span
      v-if="overflow > 0"
      class="inline-flex shrink-0 items-center justify-center border border-white/50 rounded bg-black/60 px-0.5 text-white font-medium leading-none"
      :style="{ height: `${pillPx}px`, fontSize: `${Math.max(7, pillPx - 4)}px` }"
      :title="`还有 ${overflow} 个 buff 未显示`"
    >+{{ overflow }}</span>
  </div>
</template>
