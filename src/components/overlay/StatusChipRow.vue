<script setup lang="ts">
// SceneOverlayLayer 直接消费的 wrapper。
// 输入是角色原始 status[] 数组 + 拥挤标志,过滤 + 选形态都在这里完成。
import type { CcfoliaStatus } from '@/types/ccfolia'
import { computed } from 'vue'
import { extractStatusChips } from '@/core/overlay/status-chip'
import StatusChip from './StatusChip.vue'
import StatusInline from './StatusInline.vue'

const props = defineProps<{
  status: CcfoliaStatus[]
  compact: boolean
}>()

const items = computed(() => extractStatusChips(props.status))

const inlineItems = computed(() => items.value.map(i => ({
  label: i.label,
  glyph: i.record.glyph,
  hue: i.record.hue,
  polarity: i.record.polarity,
  value: i.value,
})))
</script>

<template>
  <div
    v-if="items.length > 0"
    class="pointer-events-none flex flex-col items-center gap-0.5"
  >
    <StatusInline v-if="compact" :items="inlineItems" />
    <template v-else>
      <StatusChip
        v-for="i in items"
        :key="i.label"
        :label="i.label"
        :glyph="i.record.glyph"
        :hue="i.record.hue"
        :polarity="i.record.polarity"
        :value="i.value"
      />
    </template>
  </div>
</template>
