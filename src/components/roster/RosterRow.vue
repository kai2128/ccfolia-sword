<script setup lang="ts">
import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { moveCharacterOffBoard } from '@/ccfolia/writers/move-character-off-board'
import { setCharacterActive } from '@/ccfolia/writers/set-character-active'
import { setCharacterCell } from '@/ccfolia/writers/set-character-cell'
import BuffRow from '@/components/buffs/BuffRow.vue'
import HpMpEditor from '@/components/combat/HpMpEditor.vue'
import TagAttachPopover from '@/components/roster/TagAttachPopover.vue'
import { collectBuffs } from '@/core/buff/collect'
import { formatCellRef, pxToCell } from '@/core/range'
import { readStatusSlot } from '@/core/status-slot'
import { primaryTag as pickPrimaryTag, readTagInstances, resolveTags } from '@/core/tag'
import { useEncounterStore } from '@/stores/encounter'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  char: CcfoliaCharacter
  labelMap: StatusLabelMap
  expanded: boolean
}>()

const emit = defineEmits<{
  (e: 'change', slot: StatusSlot, newValue: number): void
  (e: 'toggleExpand'): void
  (e: 'attachBuff'): void
}>()

const hp = computed(() => readStatusSlot(props.char.status, 'hp', props.labelMap))
const mp = computed(() => readStatusSlot(props.char.status, 'mp', props.labelMap))

const overlayVis = useOverlayVisibilityStore()
const pillVisible = computed(() => overlayVis.isVisible(props.char._id))

function togglePill() {
  overlayVis.toggle(props.char._id)
}

const encounter = useEncounterStore()
const rangeActive = computed(() => props.char._id in encounter.shared.rangeCircles)
const rangeRadius = computed(() => encounter.shared.rangeCircles[props.char._id] ?? 3)

function toggleRange() {
  encounter.toggleRangeCircle(props.char._id, 3)
}

function onRangeInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(v) && v >= 1)
    encounter.setRangeRadius(props.char._id, v)
}

// Tag selector 放在行末,按钮颜色直接取主 tag 色 —— 不再在行里重复渲染 tag chips
const lib = useTagLibraryStore()
const primary = computed(() =>
  pickPrimaryTag(resolveTags(readTagInstances(props.char), lib.byId)),
)
const buffs = computed(() => collectBuffs(props.char))

const settings = useSettingsStore()

// 当前格位文本:在板内显示如 "5J",在板外返空字符串(input placeholder 显示"板外")
const cellText = computed(() => {
  const cell = pxToCell({ x: props.char.x as number, y: props.char.y as number }, settings.grid)
  return cell ? formatCellRef(cell) : ''
})

const offBoard = computed(() => {
  const cell = pxToCell({ x: props.char.x as number, y: props.char.y as number }, settings.grid)
  return cell === null
})

async function onCellInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value.trim()
  if (!raw)
    return
  try {
    await setCharacterCell(props.char._id, raw, settings.grid)
  }
  catch (err) {
    // eslint-disable-next-line no-alert
    alert((err as Error).message)
    input.value = cellText.value
  }
}

async function onMoveOffBoard() {
  if (offBoard.value)
    return
  try {
    await moveCharacterOffBoard(props.char._id, settings.grid)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`移出板失败:${(e as Error).message}`)
  }
}

async function onSetInactive() {
  // eslint-disable-next-line no-alert
  if (!window.confirm(`将 ${props.char.name} 设为非激活?可在 ccfolia 角色管理重新激活。`))
    return
  try {
    await setCharacterActive(props.char._id, false)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`设非激活失败:${(e as Error).message}`)
  }
}
</script>

<template>
  <li class="border-b border-white/5 px-1 py-1 last:border-b-0">
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded hover:bg-white/10"
        :class="pillVisible ? 'text-white' : 'text-white/30'"
        :title="pillVisible ? '隐藏场景上的 HP/MP 指示' : '显示场景上的 HP/MP 指示'"
        @click="togglePill"
      >
        <span :class="pillVisible ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="text-3.5" />
      </button>

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded hover:bg-white/10"
        :class="rangeActive ? 'text-white' : 'text-white/30'"
        :title="rangeActive ? '关闭射程圈' : '显示射程圈'"
        @click="toggleRange"
      >
        <span class="i-lucide-ruler text-3.5" />
      </button>
      <input
        v-if="rangeActive"
        type="number"
        min="1"
        :value="rangeRadius"
        class="h-5 w-10 shrink-0 border border-white/20 rounded bg-black/30 px-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
        title="射程半径(格=米)"
        @change="onRangeInput"
      >

      <span class="min-w-0 flex-1 truncate text-sm text-white">{{ char.name }}</span>

      <HpMpEditor
        v-if="hp"
        kind="hp"
        :value="hp.value"
        :max="hp.max"
        @change="v => emit('change', 'hp', v)"
      />
      <span v-else class="shrink-0 text-xs text-white/40">HP —</span>

      <HpMpEditor
        v-if="mp"
        kind="mp"
        :value="mp.value"
        :max="mp.max"
        @change="v => emit('change', 'mp', v)"
      />
      <span v-else class="shrink-0 text-xs text-white/40">MP —</span>

      <TagAttachPopover :char="char" :primary="primary" />

      <input
        type="text"
        :value="cellText"
        :placeholder="offBoard ? '板外' : '5J'"
        class="h-5 w-12 shrink-0 border border-white/20 rounded bg-black/30 px-1 text-center text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-accent"
        title="输入格位(例 5J)定位 piece"
        @change="onCellInputChange"
      >

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-30"
        :disabled="offBoard"
        title="移出板(可用格位输入框拉回)"
        @click="onMoveOffBoard"
      >
        <span class="i-lucide-archive text-3.5" />
      </button>

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-white/40 hover:bg-debuff/20 hover:text-debuff"
        title="设为非激活(从 sword roster 移除,可在 ccfolia 恢复)"
        @click="onSetInactive"
      >
        <span class="i-lucide-power-off text-3.5" />
      </button>

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
      <BuffRow
        v-for="buff in buffs"
        :key="buff.id"
        :character-id="char._id"
        :buff="buff"
      />
      <button
        type="button"
        class="self-start border border-white/15 rounded bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
        @click="emit('attachBuff')"
      >
        + 挂 buff
      </button>
    </div>
  </li>
</template>
