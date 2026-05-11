<script setup lang="ts">
import type { CharacterPartView } from '@/core/character/parts'
import type { StatusLabelMap, StatusSlot } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { num } from '@/ccfolia/pieces-store'
import { applyBuffBatch } from '@/ccfolia/writers/apply-buff-batch'
import { moveCharacterByCells } from '@/ccfolia/writers/move-character-by-cells'
import { moveCharacterOffBoard } from '@/ccfolia/writers/move-character-off-board'
import { saveCharacterParked } from '@/ccfolia/writers/save-character-parked'
import { sendCharacterToParked } from '@/ccfolia/writers/send-character-to-parked'
import { setCharacterActive } from '@/ccfolia/writers/set-character-active'
import { setCharacterAngle } from '@/ccfolia/writers/set-character-angle'
import { setCharacterCell } from '@/ccfolia/writers/set-character-cell'
import { setCharacterHideStatus } from '@/ccfolia/writers/set-character-hide-status'
import BuffRow from '@/components/buffs/BuffRow.vue'
import TagAttachPopover from '@/components/roster/TagAttachPopover.vue'
import { CellEdit, NumberEdit, PopConfirm } from '@/components/ui'
import { collectBuffsForPart } from '@/core/buff/collect'
import { extractStatusChips } from '@/core/overlay/status-chip'
import { readParkedLocation } from '@/core/parked-location'
import { formatCellRef, isPieceOffBoard, pieceBottomCenter, pxToCell } from '@/core/range'
import { readStatusSlot } from '@/core/status-slot'
import { primaryTag as pickPrimaryTag, readTagInstances, resolveTags } from '@/core/tag'
import { useEncounterStore } from '@/stores/encounter'
import { useHpmpVariantOverrideStore } from '@/stores/hpmp-variant-override'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'
import RosterRowBoardMenu from './RosterRowBoardMenu.vue'
import StatusBuffMenu from './StatusBuffMenu.vue'

const props = defineProps<{
  char: CcfoliaCharacter
  labelMap: StatusLabelMap
  expanded: boolean
  // null 表示多部位主行 —— HP/MP 由子行显示,主行只放占位保持横向对齐。
  partView: CharacterPartView | null
}>()

const emit = defineEmits<{
  (e: 'change', slot: StatusSlot, newValue: number, partKey: string): void
  (e: 'toggleExpand'): void
  (e: 'attachBuff'): void
}>()

const hasEditor = computed(() => props.partView !== null)
const hp = computed(() =>
  props.partView
    ? readStatusSlot(props.char.status, 'hp', props.labelMap, props.partView.partKey)
    : null,
)
const mp = computed(() =>
  props.partView?.mpLabel
    ? readStatusSlot(props.char.status, 'mp', props.labelMap, props.partView.partKey)
    : null,
)
const partKey = computed(() => props.partView?.partKey ?? '')

const overlayVis = useOverlayVisibilityStore()
const pillVisible = computed(() => overlayVis.isVisible(props.char._id))

function togglePill() {
  overlayVis.toggle(props.char._id)
}

const variantOverride = useHpmpVariantOverrideStore()
const variantMode = computed(() => variantOverride.get(props.char._id))
const variantIcon = computed(() => {
  if (variantMode.value === 'C')
    return 'i-lucide-rectangle-horizontal'
  if (variantMode.value === 'E')
    return 'i-lucide-pill'
  return 'i-lucide-circle-dashed'
})
const variantTitle = computed(() => {
  if (variantMode.value === 'C')
    return 'HP/MP 显示:强制 C(条状)· 点击切到 E'
  if (variantMode.value === 'E')
    return 'HP/MP 显示:强制 E(药丸)· 点击切到自动'
  return 'HP/MP 显示:自动 · 点击切到强制 C'
})

function cycleVariant() {
  variantOverride.cycle(props.char._id)
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
// 多部位主行(partView=null)展示 char 级 buff(partKey='');单部位 / 子行展示自己 partKey 的
const buffs = computed(() =>
  collectBuffsForPart(props.char, props.partView?.partKey ?? ''),
)

const settings = useSettingsStore()

// 仅当角色身上有命中 高昂 / 镇静 / 魅惑 前缀的 status 时才出 music 按钮 —— 没有就什么也不渲染。
const hasStatusChips = computed(() => extractStatusChips(props.char.status).length > 0)

// 当前格位文本:在板内显示如 "5J",在板外返空字符串(input placeholder 显示"板外")。
// 用 piece 底边中点(脚下),和 setCharacterCell / moveCharacterByCells / useOnCanvasIds 锚点一致。
// 底边中点正好落在 cell 底边时,floor 会推到下一格,所以减去一个 epsilon。
const currentCell = computed(() => {
  const grid = settings.grid
  const bottomCenter = pieceBottomCenter({
    x: props.char.x as number,
    y: props.char.y as number,
    widthCells: num(props.char.width, 1),
    heightCells: num(props.char.height, 1),
  }, grid)
  return pxToCell({ x: bottomCenter.x, y: bottomCenter.y - 0.001 }, grid)
})
const cellText = computed(() => currentCell.value ? formatCellRef(currentCell.value) : '')
const offBoard = computed(() => isPieceOffBoard({
  x: props.char.x,
  y: props.char.y,
  widthCells: num(props.char.width, 1),
  heightCells: num(props.char.height, 1),
}, settings.grid))

// 已保存的板外位置:从 char.params 的 cs_park 条目读出。
const parked = computed(() => readParkedLocation(props.char))
const hasParked = computed(() => parked.value !== null)

// hideStatus=true 时 ccfolia 把角色从板上角色一览里隐掉(盤上のキャラクター一覧に表示しない)
const isHidden = computed(() => props.char.hideStatus === true)

// angle 非 0 即视为倒地(点击切换会归位到 0;缺字段按 0 处理)
const isDown = computed(() => (Number(props.char.angle) || 0) !== 0)

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

async function onToggleDown() {
  try {
    await setCharacterAngle(props.char._id, isDown.value ? 0 : 90)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`切换倒地失败:${(e as Error).message}`)
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

async function onSaveParked() {
  try {
    await saveCharacterParked(props.char._id, props.char.x as number, props.char.y as number)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`保存板外位置失败:${(e as Error).message}`)
  }
}

async function onSendToParked(restoreHpMp: boolean) {
  try {
    await sendCharacterToParked(props.char._id, { restoreHpMp })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`送回板外失败:${(e as Error).message}`)
  }
}

async function onClearBuffs() {
  try {
    await applyBuffBatch({
      kind: 'clear',
      targets: [{ characterId: props.char._id, partKey: partKey.value || undefined }],
    })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`清除 buff 失败:${(e as Error).message}`)
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

      <template v-if="hasEditor">
        <NumberEdit
          v-if="hp"
          :value="hp.value"
          :max="hp.max"
          @change="v => emit('change', 'hp', v, partKey)"
        />
        <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />

        <NumberEdit
          v-if="mp"
          :value="mp.value"
          :max="mp.max"
          @change="v => emit('change', 'mp', v, partKey)"
        />
        <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
      </template>
      <template v-else>
        <span aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
        <span aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
      </template>

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
        :class="variantMode === 'auto' ? 'text-white/30' : 'text-white'"
        :title="variantTitle"
        @click="cycleVariant"
      >
        <span :class="variantIcon" class="text-3.5" />
      </button>

      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded hover:bg-white/10"
        :class="isDown ? 'text-debuff' : 'text-white/30'"
        :title="isDown ? '已倒地 · 点击站起' : '倒地'"
        @click="onToggleDown"
      >
        <span :class="isDown ? 'i-mdi-human-handsdown' : 'i-mdi-human'" class="text-3.5" />
      </button>

      <RosterRowBoardMenu
        :off-board="offBoard"
        :has-parked="hasParked"
        @toggle-board="onToggleBoard"
        @send-to-parked="onSendToParked(false)"
        @send-to-parked-restore="onSendToParked(true)"
        @save-parked="onSaveParked"
      />

      <PopConfirm
        v-if="hasParked"
        :message="`送回 ${char.name} 到板外,并把全部部位 HP / MP 回满?`"
        confirm-text="送回 + 回满"
        @confirm="onSendToParked(true)"
      >
        <button
          type="button"
          class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-emerald-400/70 hover:bg-emerald-400/15 hover:text-emerald-300"
          title="送回板外 + 全部部位 HP / MP 回满"
        >
          <span class="i-lucide-heart-pulse text-3.5" />
        </button>
      </PopConfirm>
      <button
        v-else
        type="button"
        class="h-5 w-5 flex shrink-0 cursor-not-allowed items-center justify-center rounded text-white/15"
        title="还没保存过板外位置"
        disabled
      >
        <span class="i-lucide-heart-pulse text-3.5" />
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
      <div class="flex items-center gap-1.5">
        <TagAttachPopover :char="char" :primary="primary" />
        <button
          type="button"
          class="border border-white/15 rounded bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          @click="emit('attachBuff')"
        >
          + 挂 buff
        </button>
        <PopConfirm
          v-if="buffs.length > 0"
          :message="`清空 ${char.name} 身上全部单体 buff(${buffs.length} 条)?`"
          confirm-text="清空"
          @confirm="onClearBuffs"
        >
          <button
            type="button"
            class="border border-white/15 rounded bg-black/20 px-2 py-1 text-xs text-white/40 hover:bg-debuff/20 hover:text-debuff"
            title="清空当前 part 上所有单体 buff"
          >
            清空 buff
          </button>
        </PopConfirm>
        <StatusBuffMenu v-if="hasStatusChips" :char="char" />
        <button
          type="button"
          class="h-6 inline-flex items-center gap-1 border border-white/15 rounded bg-black/20 px-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          :title="isHidden ? '在 ccfolia 一览中显示' : '从 ccfolia 一览隐藏'"
          @click="onToggleHideStatus"
        >
          <span :class="isHidden ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="shrink-0 text-3.5" />
          <span>{{ isHidden ? '一览中显示' : '一览隐藏' }}</span>
        </button>
        <PopConfirm
          :message="`把 ${char.name} 从角色一览移除? 可在 ccfolia 角色管理重新添加`"
          confirm-text="移除"
          @confirm="onSetInactive"
        >
          <button
            type="button"
            class="h-6 inline-flex items-center gap-1 border border-white/15 rounded bg-black/20 px-1.5 text-xs text-white/40 hover:bg-debuff/20 hover:text-debuff"
            title="移除角色 (set inactive)"
          >
            <span class="i-lucide-trash-2 shrink-0 text-3.5" />
            <span>移除角色</span>
          </button>
        </PopConfirm>
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
