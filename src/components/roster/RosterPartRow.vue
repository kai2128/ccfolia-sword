<script setup lang="ts">
import type { CharacterPartView } from '@/core/character/parts'
import type { StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import BuffRow from '@/components/buffs/BuffRow.vue'
import { NumberEdit } from '@/components/ui'
import { collectBuffsForPart } from '@/core/buff/collect'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  char: CcfoliaCharacter
  part: CharacterPartView
  expanded: boolean
}>()

const emit = defineEmits<{
  (e: 'change', slot: StatusSlot, newValue: number, partKey: string): void
  (e: 'toggleExpand'): void
  (e: 'attachBuff'): void
}>()

const settings = useSettingsStore()

const hp = computed(() => readStatusSlot(props.char.status, 'hp', settings.statusLabelMap, props.part.partKey))
const mp = computed(() =>
  props.part.mpLabel
    ? readStatusSlot(props.char.status, 'mp', settings.statusLabelMap, props.part.partKey)
    : null,
)
const buffs = computed(() => collectBuffsForPart(props.char, props.part.partKey))
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

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-xs text-white/60 hover:bg-white/10 hover:text-white"
        :title="expanded ? '收起 buff' : '展开 buff'"
        @click="emit('toggleExpand')"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>
    </div>

    <div v-if="expanded" class="mt-2 flex flex-col gap-1 pl-6">
      <button
        type="button"
        class="self-start border border-white/15 rounded bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
        @click="emit('attachBuff')"
      >
        + 挂 buff
      </button>
      <BuffRow
        v-for="buff in buffs"
        :key="buff.id"
        :character-id="char._id"
        :buff="buff"
      />
    </div>
  </li>
</template>
