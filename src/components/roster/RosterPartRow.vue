<script setup lang="ts">
import type { CharacterPartView } from '@/core/character/parts'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import { NumberEdit } from '@/components/ui'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'

// 多部位子行:不显示位置/射程/tag/archive 等 parent 级动作,
// 只展示 part 名 + HP NumberEdit(+ MP if exists)。
// 通过和 parent 行同结构的 invisible 占位符,让 HP/MP 与 parent 同 x 列对齐。
const props = defineProps<{
  char: CcfoliaCharacter
  part: CharacterPartView
}>()

const settings = useSettingsStore()

const hp = computed(() => readStatusSlot(props.char.status, 'hp', settings.statusLabelMap, props.part.partKey))
const mp = computed(() =>
  props.part.mpLabel
    ? readStatusSlot(props.char.status, 'mp', settings.statusLabelMap, props.part.partKey)
    : null,
)

async function onHpChange(newValue: number) {
  try {
    await writeStatusValue({ char: props.char, slot: 'hp', newValue, labelMap: settings.statusLabelMap, partPrefix: props.part.partKey })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
}

async function onMpChange(newValue: number) {
  try {
    await writeStatusValue({ char: props.char, slot: 'mp', newValue, labelMap: settings.statusLabelMap, partPrefix: props.part.partKey })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
}
</script>

<template>
  <li class="border-b border-white/5 px-1 py-1 last:border-b-0">
    <div class="flex items-center gap-1.5 pl-0">
      <span class="text-xs text-white/40">·</span>
      <span class="min-w-0 flex-1 truncate text-sm text-white/80">{{ part.partName }}</span>

      <!-- 占位:对齐 parent 的 range button(inline-flex 容器,只取按钮宽 w-5) -->
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />

      <NumberEdit
        v-if="hp"
        :value="hp.value"
        :max="hp.max"
        @change="onHpChange"
      />
      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />

      <NumberEdit
        v-if="mp"
        :value="mp.value"
        :max="mp.max"
        @change="onMpChange"
      />
      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />

      <!-- 占位:对齐 parent 的 CellEdit(w-12) + togglePill + eye + archive(ml-1.5) + trash + chevron -->
      <span aria-hidden="true" class="invisible h-5 w-12 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible ml-1.5 h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
      <span aria-hidden="true" class="invisible h-5 w-5 shrink-0" />
    </div>
  </li>
</template>
