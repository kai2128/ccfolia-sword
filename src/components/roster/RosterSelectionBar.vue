<script setup lang="ts">
// roster tab 内联多选模式的顶部 action bar(三行紧凑布局)。
// 行 1:计数 + 全选 / 反选 / 清空 / 添加已选中 + 退出
// 行 2:盟友 / 敌人 tag 快选(label 匹配,无匹配时不渲染)
// 行 3:HP/MP popover + 上场 + 送回场外 + 送回 + 回满 + 保存场外位置(动作执行时显示进度)
// selectionMode === false 时整条不渲染。其它批量动作(Buff / Tag / Overlay)仍走 BatchApplySheet。
import type { BatchProgress } from '@/components/roster/batch-apply/types'
import { computed, ref, watch } from 'vue'
import { useCcfoliaSelectionStore } from '@/ccfolia/ccfolia-selection-store'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { applyBatchMoveToCell } from '@/ccfolia/writers/apply-move-batch'
import { applyBatchSavePark, applyBatchSendToPark } from '@/ccfolia/writers/apply-parked-batch'
import { Checkbox, TagChip } from '@/components/ui'
import { useOnCanvasIds } from '@/composables/useOnCanvasIds'
import { usePartsByCharId } from '@/composables/usePartsByCharId'
import { useRosterSelectionActors } from '@/composables/useRosterSelectionActors'
import { formatActorRef } from '@/core/encounter/actor-ref'
import { readParkedLocation } from '@/core/parked-location'
import { formatCellRef } from '@/core/range'
import { groupRoster } from '@/core/roster/group'
import { readTagInstances } from '@/core/tag'
import { useRosterSelectionStore } from '@/stores/roster-selection'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'
import HpMpQuickPopover from './selection-actions/HpMpQuickPopover.vue'

const selection = useRosterSelectionStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const view = useRosterViewStore()
const lib = useTagLibraryStore()
const onCanvasIds = useOnCanvasIds()
const partsByCharId = usePartsByCharId()
const pieces = usePiecesStore()
const canvasSelection = useCcfoliaSelectionStore()

const { uniqueSelectedChars } = useRosterSelectionActors()

// 同 RosterList:量化 y 防止 piece 在格中心边界跳行
function positionOf(charId: string) {
  const p = pieces.byCharacterId(charId)
  if (!p)
    return null
  const grid = settings.grid
  const cell = grid.cellSizePx || 1
  const anchorY = grid.pieceAnchor === 'center' ? p.y - cell / 2 : p.y
  const row = Math.floor((anchorY - grid.originPx.y) / cell)
  return { x: p.x, y: row }
}

const groups = computed(() => groupRoster({
  chars: chars.all,
  isOnCanvas: id => onCanvasIds.value.has(id),
  byTagId: lib.byId,
  onCanvasOnly: view.onCanvasOnly,
  nameQuery: view.nameQuery,
  sortMode: view.sortMode,
  positionOf,
}))

// 当前 roster 视图(含 只看场上 / 名称搜索)下可见的角色
const visibleChars = computed(() => groups.value.flatMap(g => g.chars))

// 当前 roster 视图下可见的 part 级 actorRef
const visibleRefs = computed<string[]>(() => {
  const out: string[] = []
  for (const group of groups.value) {
    for (const char of group.chars) {
      const parts = partsByCharId.value.get(char._id) ?? []
      if (parts.length === 0) {
        out.push(formatActorRef(char._id, ''))
        continue
      }
      for (const p of parts)
        out.push(formatActorRef(char._id, p.partKey))
    }
  }
  return out
})

function onSelectAll() {
  selection.add(visibleRefs.value)
}
function onInvert() {
  selection.invert(visibleRefs.value)
}
function onClear() {
  selection.clear()
}
function onImportFromCanvas() {
  const ids = canvasSelection.selectedCharacterIds
  if (ids.size === 0)
    return
  for (const charId of ids) {
    const parts = partsByCharId.value.get(charId) ?? []
    if (parts.length === 0) {
      selection.add([formatActorRef(charId, '')])
      continue
    }
    selection.add(parts.map(p => formatActorRef(charId, p.partKey)))
  }
}

// 把画布选中的角色展开成 part 级 actorRef
function canvasRefs(): string[] {
  const refs: string[] = []
  for (const charId of canvasSelection.selectedCharacterIds) {
    const parts = partsByCharId.value.get(charId) ?? []
    if (parts.length === 0) {
      refs.push(formatActorRef(charId, ''))
      continue
    }
    for (const p of parts)
      refs.push(formatActorRef(charId, p.partKey))
  }
  return refs
}

// --- 单向同步:ccfolia 画布选中 → roster 选中(replace,不写回画布)---
// 画布集合签名:成员变化才触发(避免 getter 每次返回新 Set 导致空转)
const canvasSig = computed(() =>
  [...canvasSelection.selectedCharacterIds].sort().join(','),
)
watch(
  [() => selection.syncFromCanvas, () => selection.selectionMode, canvasSig],
  () => {
    if (!selection.selectionMode || !selection.syncFromCanvas)
      return
    selection.replace(canvasRefs())
  },
  { immediate: true },
)

// --- 移动:复用 RosterRowBoardMenu,自己写批量 handler ---
const offBoardCharIds = computed(() =>
  uniqueSelectedChars.value.filter(c => !onCanvasIds.value.has(c._id)).map(c => c._id),
)
const onBoardCharIds = computed(() =>
  uniqueSelectedChars.value.filter(c => onCanvasIds.value.has(c._id)).map(c => c._id),
)
const parkedCharIds = computed(() =>
  uniqueSelectedChars.value.filter(c => readParkedLocation(c) !== null).map(c => c._id),
)
// 全员场外:save-park 才有意义(场上角色没有"当前场外位置"可保存)
const allOffBoard = computed(() =>
  uniqueSelectedChars.value.length > 0 && onBoardCharIds.value.length === 0,
)
const anyParked = computed(() => parkedCharIds.value.length > 0)

async function reportFailures(label: string, failures: Array<{ charId: string, error: Error }>) {
  if (failures.length === 0)
    return
  // eslint-disable-next-line no-alert
  alert(`${label} 失败 ${failures.length} 个:\n${failures.map(f => f.error.message).join('\n')}`)
}

// 进度统一一份:同时只能跑一个移动类动作。moveBusy 同时充当"哪个按钮正在跑"的标识,
// 用来切 loader 图标与禁用其它按钮。
type MoveAction = 'enter' | 'sendParked' | 'sendParkedRestore' | 'savePark'
const moveBusy = ref<MoveAction | null>(null)
const moveProgress = ref<BatchProgress | null>(null)

function makeOnProgress() {
  return (done: number, total: number) => {
    moveProgress.value = { done, total }
  }
}

// 上场:全员场外 → 放到场上中央格(混合状态时按钮禁用,不会进来)
async function onBatchEnterBoard() {
  if (moveBusy.value !== null || offBoardCharIds.value.length === 0)
    return
  moveBusy.value = 'enter'
  moveProgress.value = { done: 0, total: 0 }
  try {
    const grid = settings.grid
    const center = { col: Math.floor(grid.cols / 2), row: Math.floor(grid.rows / 2) }
    const result = await applyBatchMoveToCell({
      charIds: offBoardCharIds.value,
      cellRef: formatCellRef(center),
      grid,
      onProgress: makeOnProgress(),
    })
    await reportFailures('放回场上中央', result.failures)
  }
  finally {
    moveBusy.value = null
    moveProgress.value = null
  }
}

async function onBatchSendToParked(restoreHpMp: boolean) {
  if (moveBusy.value !== null || parkedCharIds.value.length === 0)
    return
  moveBusy.value = restoreHpMp ? 'sendParkedRestore' : 'sendParked'
  moveProgress.value = { done: 0, total: 0 }
  try {
    const result = await applyBatchSendToPark(
      parkedCharIds.value,
      { restoreHpMp },
      makeOnProgress(),
    )
    await reportFailures(restoreHpMp ? '送回 + 回满' : '送回场外', result.failures)
  }
  finally {
    moveBusy.value = null
    moveProgress.value = null
  }
}

async function onBatchSavePark() {
  if (moveBusy.value !== null || offBoardCharIds.value.length === 0)
    return
  moveBusy.value = 'savePark'
  moveProgress.value = { done: 0, total: 0 }
  try {
    const result = await applyBatchSavePark(
      offBoardCharIds.value,
      settings.grid,
      makeOnProgress(),
    )
    await reportFailures('保存场外位置', result.failures)
  }
  finally {
    moveBusy.value = null
    moveProgress.value = null
  }
}

// --- 盟友 / 敌人 tag 快选(label 匹配,只显示有的)---
// 复用 BatchApplySheet 的 tagBucket 语义:点击切全部 part 加/减
const TAG_FILTER_LABELS = ['盟友', '敌人']
interface TagBucket {
  id: string
  label: string
  color: string
  charIds: string[]
}
const tagBuckets = computed<TagBucket[]>(() => {
  const defs = lib.all.filter(t => TAG_FILTER_LABELS.includes(t.label))
  const out: TagBucket[] = []
  for (const def of defs) {
    const charIds: string[] = []
    // 跟随当前视图过滤(只看场上 / 名称搜索),与批量抽屉口径一致
    for (const char of visibleChars.value) {
      const tagIds = readTagInstances(char).map(t => t.definitionId)
      if (tagIds.includes(def.id))
        charIds.push(char._id)
    }
    if (charIds.length > 0)
      out.push({ id: def.id, label: def.label, color: def.color, charIds })
  }
  return out
})

function bucketRefs(bucket: TagBucket): string[] {
  const out: string[] = []
  for (const charId of bucket.charIds) {
    const parts = partsByCharId.value.get(charId) ?? []
    if (parts.length === 0) {
      out.push(formatActorRef(charId, ''))
      continue
    }
    for (const p of parts)
      out.push(formatActorRef(charId, p.partKey))
  }
  return out
}
function tagBucketState(bucket: TagBucket): 'all' | 'partial' | 'none' {
  const refs = bucketRefs(bucket)
  let hit = 0
  for (const r of refs) {
    if (selection.has(r))
      hit++
  }
  if (hit === 0)
    return 'none'
  if (hit === refs.length)
    return 'all'
  return 'partial'
}
function toggleTagBucket(bucket: TagBucket) {
  const refs = bucketRefs(bucket)
  if (tagBucketState(bucket) === 'all')
    selection.remove(refs)
  else
    selection.add(refs)
}
</script>

<template>
  <div
    v-if="selection.selectionMode"
    class="flex flex-col gap-1 border border-accent/40 rounded bg-accent/10 px-1.5 py-1"
  >
    <!-- 行 1:选择助手 + 退出 -->
    <div class="flex flex-wrap items-center gap-1">
      <span class="px-1 text-xs text-white tabular-nums">
        <span class="text-accent">✔ {{ selection.size }}</span>
        <span class="text-white/40"> / {{ visibleRefs.length }}</span>
      </span>

      <button
        type="button"
        class="h-6 border border-white/20 rounded bg-black/30 px-1.5 text-xs text-white/70 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-white/10 hover:enabled:text-white"
        :disabled="visibleRefs.length === 0"
        title="把当前过滤下的全部行加进选择"
        @click="onSelectAll"
      >
        全选
      </button>
      <button
        type="button"
        class="h-6 border border-white/20 rounded bg-black/30 px-1.5 text-xs text-white/70 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-white/10 hover:enabled:text-white"
        :disabled="visibleRefs.length === 0"
        title="对当前过滤下的全部行翻转选中"
        @click="onInvert"
      >
        反选
      </button>
      <button
        type="button"
        class="h-6 border border-white/20 rounded bg-black/30 px-1.5 text-xs text-white/70 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-white/10 hover:enabled:text-white"
        :disabled="selection.size === 0"
        title="清空所有选中(含过滤外的)"
        @click="onClear"
      >
        清空
      </button>
      <label
        class="h-6 flex cursor-pointer select-none items-center gap-1 border rounded px-1.5 text-xs transition-colors"
        :class="selection.syncFromCanvas
          ? 'border-accent bg-accent/20 text-white'
          : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        title="开启后:ccfolia 画布的选中会实时同步到这里(整体替换)。在此处手动改动不会写回画布。"
      >
        <Checkbox
          :model-value="selection.syncFromCanvas"
          @update:model-value="selection.toggleSyncFromCanvas()"
        />
        同步选中
      </label>

      <button
        type="button"
        class="h-6 flex items-center gap-1 border border-white/20 rounded bg-black/30 px-1.5 text-xs text-white/70 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-white/10 hover:enabled:text-white"
        :disabled="!canvasSelection.hasCharacterSelection"
        :title="canvasSelection.hasCharacterSelection
          ? `把 ccfolia 画布上已选中的 ${canvasSelection.selectedCharacterIds.size} 个角色合并加进来`
          : '先在 ccfolia 画布上选中角色(Shift+点击 / Cmd+拖拽)再点这里'"
        @click="onImportFromCanvas"
      >
        <span class="i-lucide-square-dashed-mouse-pointer text-3" />
        添加已选中
      </button>

      <button
        type="button"
        class="ml-auto h-6 flex items-center gap-1 border border-white/20 rounded bg-black/30 px-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="退出多选模式 · 清空已选"
        @click="selection.exit()"
      >
        <span class="i-lucide-x text-3" />
        退出
      </button>
    </div>

    <!-- 行 2:盟友 / 敌人 tag 快选(label 匹配,无匹配时整行不渲染) -->
    <div v-if="tagBuckets.length > 0" class="flex flex-wrap items-center gap-1">
      <span class="px-1 text-[10px] text-white/40">按 tag:</span>
      <button
        v-for="bucket in tagBuckets"
        :key="bucket.id"
        type="button"
        class="h-6 inline-flex items-center gap-1 border rounded px-1.5 text-xs transition-colors"
        :class="{
          'border-accent bg-accent/20 text-white': tagBucketState(bucket) === 'all',
          'border-accent/40 bg-accent/5 text-white/80': tagBucketState(bucket) === 'partial',
          'border-white/15 bg-black/30 text-white/60 hover:bg-white/10': tagBucketState(bucket) === 'none',
        }"
        :title="`点击切换 ${bucket.label} 下 ${bucket.charIds.length} 人(含全部 part)的选中`"
        @click="toggleTagBucket(bucket)"
      >
        <TagChip :tag="{ id: bucket.id, label: bucket.label, color: bucket.color, order: 0, builtin: true }" size="xs" />
        <span class="text-white/50">·{{ bucket.charIds.length }}</span>
      </button>
    </div>

    <!-- 行 3:批量动作(HP/MP · 上场 · 送回场外 · 送回+回满 · 保存场外位置) -->
    <div class="flex flex-wrap items-center gap-1">
      <HpMpQuickPopover />

      <span class="mx-1 h-4 w-px bg-white/20" />

      <!-- 上场:全员场外才启用,放到场上中央格 -->
      <button
        type="button"
        class="h-6 flex shrink-0 items-center gap-1 border rounded px-1.5 text-xs transition-colors disabled:cursor-not-allowed"
        :class="allOffBoard && moveBusy === null
          ? 'border-white/20 bg-black/30 text-white/80 hover:bg-white/10 hover:text-white'
          : 'border-white/10 bg-black/20 text-white/25'"
        :disabled="!allOffBoard || moveBusy !== null"
        :title="!allOffBoard ? '需选中全部为场外角色才能上场' : `上场到场上中央格 · ${offBoardCharIds.length} 人`"
        @click="onBatchEnterBoard"
      >
        <span :class="moveBusy === 'enter' ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-log-in'" class="text-3" />
        <span v-if="moveBusy === 'enter' && moveProgress" class="tabular-nums">{{ moveProgress.done }}/{{ moveProgress.total }}</span>
        <span v-else>上场</span>
      </button>

      <!-- 送回场外:任一有 parked 位置就启用 -->
      <button
        type="button"
        class="h-6 flex shrink-0 items-center gap-1 border rounded px-1.5 text-xs transition-colors disabled:cursor-not-allowed"
        :class="anyParked && moveBusy === null
          ? 'border-white/20 bg-black/30 text-white/80 hover:bg-white/10 hover:text-white'
          : 'border-white/10 bg-black/20 text-white/25'"
        :disabled="!anyParked || moveBusy !== null"
        :title="anyParked ? `送回保存的场外位置 · ${parkedCharIds.length} 人有记录` : '选中角色都没有保存的场外位置'"
        @click="onBatchSendToParked(false)"
      >
        <span :class="moveBusy === 'sendParked' ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-home'" class="text-3" />
        <span v-if="moveBusy === 'sendParked' && moveProgress" class="tabular-nums">{{ moveProgress.done }}/{{ moveProgress.total }}</span>
        <span v-else>送回场外</span>
      </button>

      <!-- 送回 + 回满 HP/MP -->
      <button
        type="button"
        class="h-6 flex shrink-0 items-center gap-1 border rounded px-1.5 text-xs transition-colors disabled:cursor-not-allowed"
        :class="anyParked && moveBusy === null
          ? 'border-white/20 bg-black/30 text-emerald-300 hover:bg-emerald-400/15'
          : 'border-white/10 bg-black/20 text-white/25'"
        :disabled="!anyParked || moveBusy !== null"
        :title="anyParked ? `送回保存的场外位置 + 全部部位 HP/MP 回满 · ${parkedCharIds.length} 人有记录` : '选中角色都没有保存的场外位置'"
        @click="onBatchSendToParked(true)"
      >
        <span :class="moveBusy === 'sendParkedRestore' ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-heart-pulse'" class="text-3" />
        <span v-if="moveBusy === 'sendParkedRestore' && moveProgress" class="tabular-nums">{{ moveProgress.done }}/{{ moveProgress.total }}</span>
        <span v-else>送回+回满</span>
      </button>

      <!-- 保存场外位置:全员场外才启用 -->
      <button
        type="button"
        class="h-6 flex shrink-0 items-center gap-1 border rounded px-1.5 text-xs transition-colors disabled:cursor-not-allowed"
        :class="allOffBoard && moveBusy === null
          ? 'border-buff/40 bg-buff/15 text-buff hover:bg-buff/25'
          : 'border-white/10 bg-black/20 text-white/25'"
        :disabled="!allOffBoard || moveBusy !== null"
        :title="!allOffBoard
          ? '需选中全部为场外角色才能记录当前位置'
          : (anyParked ? `更新场外位置(覆盖已有)· ${offBoardCharIds.length} 人` : `保存当前位置作为场外位置 · ${offBoardCharIds.length} 人`)"
        @click="onBatchSavePark"
      >
        <span :class="moveBusy === 'savePark' ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-bookmark-plus'" class="text-3" />
        <span v-if="moveBusy === 'savePark' && moveProgress" class="tabular-nums">{{ moveProgress.done }}/{{ moveProgress.total }}</span>
        <span v-else>保存场外位置</span>
      </button>
    </div>
  </div>
</template>
