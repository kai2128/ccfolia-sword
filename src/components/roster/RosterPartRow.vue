<script setup lang="ts">
import type { CharacterPartView } from '@/core/character/parts'
import type { StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { NumberEdit } from '@/components/ui'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  char: CcfoliaCharacter
  part: CharacterPartView
}>()

const emit = defineEmits<{
  (e: 'change', slot: StatusSlot, newValue: number, partKey: string): void
}>()

const settings = useSettingsStore()

const hp = computed(() => readStatusSlot(props.char.status, 'hp', settings.statusLabelMap, props.part.partKey))
const mp = computed(() =>
  props.part.mpLabel
    ? readStatusSlot(props.char.status, 'mp', settings.statusLabelMap, props.part.partKey)
    : null,
)
</script>

<template>
  <li class="border-b border-white/5 px-1 py-1 last:border-b-0">
    <div class="flex items-center gap-1.5 pl-0">
      <span class="text-xs text-white/40">·</span>
      <span class="min-w-0 flex-1 truncate text-sm text-white/80">{{ part.partName }}</span>

      <!-- 下面这一长串 invisible 占位是为了让 HP/MP 列与 RosterRow 主行纵向对齐;
           主行加按钮时这里也要同步加占位,否则列就错位。 -->
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />

      <NumberEdit
        v-if="hp"
        :value="hp.value"
        :max="hp.max"
        @change="v => emit('change', 'hp', v, part.partKey)"
      />
      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />

      <NumberEdit
        v-if="mp"
        :value="mp.value"
        :max="mp.max"
        @change="v => emit('change', 'mp', v, part.partKey)"
      />
      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />

      <span aria-hidden="true" class="invisible h-5 w-12 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible ml-1.5 h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
    </div>
  </li>
</template>
