<script setup lang="ts">
import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import HpMpEditor from '@/components/combat/HpMpEditor.vue'
import TagAttachPopover from '@/components/roster/TagAttachPopover.vue'
import { TagChip } from '@/components/ui'
import { readStatusSlot } from '@/core/status-slot'
import { readTagInstances, resolveTags, sortByOrder } from '@/core/tag'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useTagLibraryStore } from '@/stores/tag-library'

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

const lib = useTagLibraryStore()
const tags = computed(() =>
  sortByOrder(resolveTags(readTagInstances(props.char), lib.byId)),
)
</script>

<template>
  <li class="flex flex-col gap-1 border-b border-white/5 py-2 last:border-b-0">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="h-5 w-5 flex items-center justify-center border border-white/30 rounded text-xs leading-none"
        :class="pillVisible ? 'text-white' : 'text-white/40'"
        :title="pillVisible ? '隐藏场景上的 HP/MP 指示' : '显示场景上的 HP/MP 指示'"
        @click="togglePill"
      >
        {{ pillVisible ? '●' : '○' }}
      </button>
      <span class="min-w-0 flex-1 truncate text-sm text-white">{{ char.name }}</span>
      <HpMpEditor
        v-if="hp"
        kind="hp"
        :value="hp.value"
        :max="hp.max"
        @change="v => emit('change', 'hp', v)"
      />
      <span v-else class="text-xs text-white/40">HP —</span>
      <HpMpEditor
        v-if="mp"
        kind="mp"
        :value="mp.value"
        :max="mp.max"
        @change="v => emit('change', 'mp', v)"
      />
      <span v-else class="text-xs text-white/40">MP —</span>
    </div>

    <div class="flex flex-wrap items-center gap-1 pl-7">
      <TagChip v-for="tag in tags" :key="tag.id" :tag="tag" size="xs" />
      <TagAttachPopover :char="char" />
    </div>
  </li>
</template>
