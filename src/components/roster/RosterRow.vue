<script setup lang="ts">
import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { moveCharacterByCells } from '@/ccfolia/writers/move-character-by-cells'
import { moveCharacterOffBoard } from '@/ccfolia/writers/move-character-off-board'
import { setCharacterActive } from '@/ccfolia/writers/set-character-active'
import { setCharacterCell } from '@/ccfolia/writers/set-character-cell'
import { setCharacterHideStatus } from '@/ccfolia/writers/set-character-hide-status'
import BuffRow from '@/components/buffs/BuffRow.vue'
import TagAttachPopover from '@/components/roster/TagAttachPopover.vue'
import { CellEdit, NumberEdit, PopConfirm } from '@/components/ui'
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

// hideStatus=true 时 ccfolia 把角色从板上角色一览里隐掉(盤上のキャラクター一覧に表示しない)
const isHidden = computed(() => props.char.hideStatus === true)

async function onCellSubmit(raw: string) {
  try {
    await setCharacterCell(props.char._id, raw, settings.grid)
  }
  catch (err) {
    // eslint-disable-next-line no-alert
    alert((err as Error).message)
  }
}

async function onCellMove(delta: { dx: number, dy: number }) {
  try {
    await moveCharacterByCells(props.char._id, delta.dx, delta.dy, settings.grid)
  }
  catch (err) {
    // eslint-disable-next-line no-alert
    alert((err as Error).message)
  }
}

// 双向 toggle:在板上 → 移出收纳位;在板外 → 放回画布中央格
async function onToggleBoard() {
  try {
    if (offBoard.value) {
      const grid = settings.grid
      const center = { col: Math.floor(grid.cols / 2), row: Math.floor(grid.rows / 2) }
      await setCharacterCell(props.char._id, formatCellRef(center), grid)
    }
    else {
      await moveCharacterOffBoard(props.char._id, settings.grid)
    }
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`操作失败:${(e as Error).message}`)
  }
}

async function onToggleHideStatus() {
  try {
    await setCharacterHideStatus(props.char._id, !isHidden.value)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`切换失败:${(e as Error).message}`)
  }
}

async function onSetInactive() {
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
      <span class="min-w-0 flex-1 truncate text-sm text-white">{{ char.name }}</span>

      <div class="inline-flex shrink-0 items-center gap-1">
        <input
          v-if="rangeActive"
          type="number"
          min="1"
          :value="rangeRadius"
          class="h-5 w-10 border border-white/20 rounded bg-black/40 px-1 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          title="射程半径(格=米)"
          @change="onRangeInput"
        >
        <button
          type="button"
          class="h-5 w-5 flex items-center justify-center rounded hover:bg-white/10"
          :class="rangeActive ? 'text-white' : 'text-white/30'"
          :title="rangeActive ? '关闭射程圈' : '显示射程圈'"
          @click="toggleRange"
        >
          <span class="i-lucide-ruler text-3.5" />
        </button>
      </div>

      <NumberEdit
        v-if="hp"
        :value="hp.value"
        :max="hp.max"
        @change="v => emit('change', 'hp', v)"
      />
      <span v-else class="shrink-0 text-xs text-white/40">HP —</span>

      <NumberEdit
        v-if="mp"
        :value="mp.value"
        :max="mp.max"
        @change="v => emit('change', 'mp', v)"
      />
      <span v-else class="shrink-0 text-xs text-white/40">MP —</span>

      <CellEdit
        :cell="cellText"
        :off-board="offBoard"
        @submit="onCellSubmit"
        @move="onCellMove"
      />

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded hover:bg-white/10"
        :class="pillVisible ? 'text-white' : 'text-white/30'"
        :title="pillVisible ? '隐藏场景上的 HP/MP 指示' : '显示场景上的 HP/MP 指示'"
        @click="togglePill"
      >
        <span class="i-lucide-chart-bar-big text-3.5" />
      </button>

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded hover:bg-white/10"
        :class="isHidden ? 'text-white/30' : 'text-white'"
        :title="isHidden ? 'ccfolia 板上角色一览已隐藏 · 点击恢复' : '从 ccfolia 板上角色一览隐藏'"
        @click="onToggleHideStatus"
      >
        <span :class="isHidden ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="text-3.5" />
      </button>

      <PopConfirm
        :message="offBoard ? `把 ${char.name} 放回画布中央?` : `把 ${char.name} 移动到 board 外?`"
        confirm-text="确认"
        @confirm="onToggleBoard"
      >
        <button
          type="button"
          class="ml-1.5 h-5 w-5 flex shrink-0 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          :title="offBoard ? '放回画布中央' : '移动到 board 外'"
        >
          <span class="i-lucide-archive text-3.5" />
        </button>
      </PopConfirm>

      <PopConfirm
        :message="`把 ${char.name} 移出 board? 可在 ccfolia 角色管理重新添加回 board`"
        confirm-text="确认"
        @confirm="onSetInactive"
      >
        <button
          type="button"
          class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-white/40 hover:bg-debuff/20 hover:text-debuff"
          title="移出 board(可在 ccfolia 重新添加)"
        >
          <span class="i-lucide-trash-2 text-3.5" />
        </button>
      </PopConfirm>

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
      <div class="flex items-center gap-1.5">
        <TagAttachPopover :char="char" :primary="primary" />
        <button
          type="button"
          class="border border-white/15 rounded bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          @click="emit('attachBuff')"
        >
          + 挂 buff
        </button>
      </div>
      <BuffRow
        v-for="buff in buffs"
        :key="buff.id"
        :character-id="char._id"
        :buff="buff"
      />
    </div>
  </li>
</template>
