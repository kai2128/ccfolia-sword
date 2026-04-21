<script setup lang="ts">
import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import HpMpEditor from '@/components/combat/HpMpEditor.vue'
import { readStatusSlot } from '@/core/status-slot'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'

const props = defineProps<{
  char: CcfoliaCharacter
  labelMap: StatusLabelMap
}>()

const emit = defineEmits<{
  (e: 'change', slot: StatusSlot, newValue: number): void
}>()

const hp = computed(() => readStatusSlot(props.char.status, 'hp', props.labelMap))
const mp = computed(() => readStatusSlot(props.char.status, 'mp', props.labelMap))

const overlayVis = useOverlayVisibilityStore()
const pillVisible = computed(() => overlayVis.isVisible(props.char._id))
function togglePill() {
  overlayVis.toggle(props.char._id)
}
</script>

<template>
  <li class="roster-row">
    <button
      class="pill-toggle"
      :class="{ off: !pillVisible }"
      :title="pillVisible ? '隐藏场景上的 HP/MP 指示' : '显示场景上的 HP/MP 指示'"
      @click="togglePill"
    >
      {{ pillVisible ? '●' : '○' }}
    </button>
    <span class="name">{{ char.name }}</span>
    <HpMpEditor
      v-if="hp"
      kind="hp"
      :value="hp.value"
      :max="hp.max"
      @change="v => emit('change', 'hp', v)"
    />
    <span v-else class="missing">HP —</span>
    <HpMpEditor
      v-if="mp"
      kind="mp"
      :value="mp.value"
      :max="mp.max"
      @change="v => emit('change', 'mp', v)"
    />
    <span v-else class="missing">MP —</span>
  </li>
</template>

<style scoped>
.roster-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.missing {
  font-size: 11px;
  opacity: 0.5;
}
.pill-toggle {
  width: 20px;
  height: 20px;
  border: 1px solid #999;
  background: transparent;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  font-size: 12px;
  color: inherit;
}
.pill-toggle.off {
  opacity: 0.45;
}
</style>
