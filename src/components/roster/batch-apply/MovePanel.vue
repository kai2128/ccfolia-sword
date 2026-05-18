<script setup lang="ts">
import type { BatchProgress } from './types'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed, reactive, ref, watch } from 'vue'
import { applyBatchMoveToCell, applyBatchShift } from '@/ccfolia/writers/apply-move-batch'
import { applyBatchSavePark, applyBatchSendToPark } from '@/ccfolia/writers/apply-parked-batch'
import { Button, Field, Input, NumberEdit } from '@/components/ui'
import { useOnCanvasIds } from '@/composables/useOnCanvasIds'
import { readParkedLocation } from '@/core/parked-location'
import { formatCellRef, parseCellRef } from '@/core/range'
import { useSettingsStore } from '@/stores/settings'
import { btnLabel } from './types'

const props = defineProps<{
  uniqueSelectedChars: CcfoliaCharacter[]
  sheetOpen: boolean
}>()

const settings = useSettingsStore()
const onCanvasIds = useOnCanvasIds()

// 位置是角色级,选中集是 part 级 → 用 uniqueSelectedChars dedupe 到 charId。
// 板内/板外划分由 onCanvasIds 实时算,各 mode 自行决定要喂哪一份给 batch writer。
type MoveMode = 'enter' | 'parked' | 'shift' | 'set'
const moveMode = ref<MoveMode>('enter')
const enterPlacement = ref<'center' | 'cell'>('center')
const enterCellInput = ref('')
const setCellInput = ref('')
const shift = reactive({ dx: 0, dy: 0 })
const moveProgress = ref<BatchProgress | null>(null)

watch(() => props.sheetOpen, (v) => {
  if (!v) {
    enterCellInput.value = ''
    setCellInput.value = ''
    shift.dx = 0
    shift.dy = 0
  }
})

const offBoardCharIds = computed(() =>
  props.uniqueSelectedChars.filter(c => !onCanvasIds.value.has(c._id)).map(c => c._id),
)
const onBoardCharIds = computed(() =>
  props.uniqueSelectedChars.filter(c => onCanvasIds.value.has(c._id)).map(c => c._id),
)
const allSelectedCharIds = computed(() => props.uniqueSelectedChars.map(c => c._id))

// 「板外位置」候选集:
//   - save:角色必须当前在板外 → 直接复用 offBoardCharIds
//   - send / send+restore:角色必须已有保存的 cs_park 条目
const parkedCharIds = computed(() =>
  props.uniqueSelectedChars.filter(c => readParkedLocation(c) !== null).map(c => c._id),
)

async function applyMove() {
  if (moveProgress.value !== null)
    return
  const grid = settings.grid
  const onProgress = (done: number, total: number) => {
    moveProgress.value = { done, total }
  }

  let resultPromise: Promise<{ ok: number, failures: Array<{ charId: string, error: Error }> }> | null = null

  if (moveMode.value === 'enter') {
    const cell = enterPlacement.value === 'center'
      ? formatCellRef({ col: Math.floor(grid.cols / 2), row: Math.floor(grid.rows / 2) })
      : enterCellInput.value.trim()
    if (!parseCellRef(cell, grid)) {
      // eslint-disable-next-line no-alert
      alert(`无效格位:${cell || '(空)'}`)
      return
    }
    if (offBoardCharIds.value.length === 0)
      return
    resultPromise = applyBatchMoveToCell({ charIds: offBoardCharIds.value, cellRef: cell, grid, onProgress })
  }
  else if (moveMode.value === 'shift') {
    if (shift.dx === 0 && shift.dy === 0)
      return
    if (onBoardCharIds.value.length === 0)
      return
    resultPromise = applyBatchShift({ charIds: onBoardCharIds.value, dx: shift.dx, dy: shift.dy, grid, onProgress })
  }
  else {
    const cell = setCellInput.value.trim()
    if (!parseCellRef(cell, grid)) {
      // eslint-disable-next-line no-alert
      alert(`无效格位:${cell || '(空)'}`)
      return
    }
    if (allSelectedCharIds.value.length === 0)
      return
    resultPromise = applyBatchMoveToCell({ charIds: allSelectedCharIds.value, cellRef: cell, grid, onProgress })
  }

  // writer 在同步调用阶段已经 onProgress(0, total) 喂过初始进度;不要再覆盖回 0/0
  try {
    const result = await resultPromise
    if (result.failures.length > 0) {
      // eslint-disable-next-line no-alert
      alert(`成功 ${result.ok} 个,失败 ${result.failures.length} 个:\n${result.failures.map(f => f.error.message).join('\n')}`)
    }
  }
  finally {
    moveProgress.value = null
  }
}

// 「板外位置」三个动作:save 当前 / send 回去 / send + 回满。失败/跳过汇总弹一次 alert。
async function applyParkedAction(kind: 'save' | 'send' | 'sendRestore') {
  if (moveProgress.value !== null)
    return
  const grid = settings.grid
  const onProgress = (done: number, total: number) => {
    moveProgress.value = { done, total }
  }

  let resultPromise: Promise<{ ok: number, skipped: number, failures: Array<{ charId: string, error: Error }> }>
  if (kind === 'save') {
    if (offBoardCharIds.value.length === 0)
      return
    resultPromise = applyBatchSavePark(offBoardCharIds.value, grid, onProgress)
  }
  else {
    if (parkedCharIds.value.length === 0)
      return
    resultPromise = applyBatchSendToPark(parkedCharIds.value, { restoreHpMp: kind === 'sendRestore' }, onProgress)
  }

  // writer 同步调用阶段已经喂过 onProgress(0, total),不要覆盖
  try {
    const result = await resultPromise
    if (result.failures.length > 0) {
      // eslint-disable-next-line no-alert
      alert(`成功 ${result.ok} 个,跳过 ${result.skipped} 个,失败 ${result.failures.length} 个:\n${result.failures.map(f => f.error.message).join('\n')}`)
    }
  }
  finally {
    moveProgress.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-3">
    <!-- mode 切换:抄 buff tab 那三个按钮的样式 -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="moveMode === 'enter' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="moveMode = 'enter'"
      >
        入板
      </button>
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="moveMode === 'parked' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="moveMode = 'parked'"
      >
        板外位置
      </button>
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="moveMode === 'shift' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="moveMode = 'shift'"
      >
        位移
      </button>
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="moveMode === 'set' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="moveMode = 'set'"
      >
        定位
      </button>
      <span class="ml-auto text-xs text-white/50">已选 {{ uniqueSelectedChars.length }} 名角色</span>
    </div>

    <!-- 入板 -->
    <template v-if="moveMode === 'enter'">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="h-7 border rounded px-2 text-xs transition-colors"
          :class="enterPlacement === 'center' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
          @click="enterPlacement = 'center'"
        >
          棋盘中心
        </button>
        <button
          type="button"
          class="h-7 border rounded px-2 text-xs transition-colors"
          :class="enterPlacement === 'cell' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
          @click="enterPlacement = 'cell'"
        >
          指定格
        </button>
      </div>
      <Field v-if="enterPlacement === 'cell'" label="目标格位" hint="如 5J / 12C;全部角色叠到该格,后续 GM 在 ccfolia 里手动拖开">
        <Input v-model="enterCellInput" placeholder="5J" />
      </Field>
      <p v-else class="text-xs text-white/50">
        全部放到棋盘中心格(可重叠)。
      </p>
      <div class="flex justify-end pt-1">
        <Button
          size="md"
          :loading="moveProgress !== null"
          :disabled="offBoardCharIds.length === 0 || (enterPlacement === 'cell' && !enterCellInput.trim())"
          @click="applyMove"
        >
          {{ moveProgress ? `应用中 ${moveProgress.done}/${moveProgress.total}` : `应用 (${offBoardCharIds.length} 在板外)` }}
        </Button>
      </div>
      <p v-if="uniqueSelectedChars.length > 0 && offBoardCharIds.length === 0" class="text-[11px] text-white/40">
        选中角色全部已在板上,跳过。
      </p>
    </template>

    <!-- 位移 -->
    <template v-else-if="moveMode === 'shift'">
      <p class="text-xs text-white/60">
        对在板上的角色整体按格平移,板外的角色跳过。dx 正方向 = 右,dy 正方向 = 下。
      </p>
      <div class="flex items-center gap-3">
        <Field label="dx (列)">
          <NumberEdit :value="shift.dx" @change="(v: number) => shift.dx = v" />
        </Field>
        <Field label="dy (行)">
          <NumberEdit :value="shift.dy" @change="(v: number) => shift.dy = v" />
        </Field>
      </div>
      <div class="flex justify-end pt-1">
        <Button
          size="md"
          :loading="moveProgress !== null"
          :disabled="onBoardCharIds.length === 0 || (shift.dx === 0 && shift.dy === 0)"
          @click="applyMove"
        >
          {{ moveProgress ? `应用中 ${moveProgress.done}/${moveProgress.total}` : `应用 (${onBoardCharIds.length} 在板上)` }}
        </Button>
      </div>
    </template>

    <!-- 定位 -->
    <template v-else-if="moveMode === 'set'">
      <p class="text-xs text-white/60">
        覆盖式写入位置:全部选中角色(包括已在板上的)都移到目标格。
      </p>
      <Field label="目标格位">
        <Input v-model="setCellInput" placeholder="5J" />
      </Field>
      <div class="flex justify-end pt-1">
        <Button
          size="md"
          :loading="moveProgress !== null"
          :disabled="allSelectedCharIds.length === 0 || !setCellInput.trim()"
          @click="applyMove"
        >
          {{ btnLabel('应用', allSelectedCharIds.length, moveProgress) }}
        </Button>
      </div>
    </template>

    <!-- 板外位置 -->
    <template v-else>
      <p class="text-xs text-white/60">
        每个角色独立记一个板外位置 (px 精确)，之后可一键送回。送回时可选是否同时回满全部部位 HP / MP。
        保存仅对当前在板外的角色生效；送回仅对已记录板外位置的角色生效。
      </p>
      <div class="grid grid-cols-2 gap-1.5 pt-1">
        <Button
          size="sm"
          :loading="moveProgress !== null"
          :disabled="parkedCharIds.length === 0"
          title="把角色精确送回各自记录的板外位置"
          @click="applyParkedAction('send')"
        >
          <span v-if="!moveProgress" class="i-lucide-home mr-1 inline-block align-[-2px] text-3" />
          {{ btnLabel('送回', parkedCharIds.length, moveProgress) }}
        </Button>
        <Button
          size="sm"
          :loading="moveProgress !== null"
          :disabled="offBoardCharIds.length === 0"
          title="把当前位置记下作为板外位置(覆盖已有);仅在板外的角色生效"
          class="text-black !bg-buff/70 hover:!bg-buff"
          @click="applyParkedAction('save')"
        >
          <span v-if="!moveProgress" class="i-lucide-bookmark-plus mr-1 inline-block align-[-2px] text-3" />
          {{ btnLabel('保存板外位置', offBoardCharIds.length, moveProgress) }}
        </Button>
        <Button
          size="sm"
          :loading="moveProgress !== null"
          :disabled="parkedCharIds.length === 0"
          title="送回板外 + 全部部位 HP / MP 回满"
          @click="applyParkedAction('sendRestore')"
        >
          <span v-if="!moveProgress" class="i-lucide-heart-pulse mr-1 inline-block align-[-2px] text-3" />
          {{ btnLabel('送回 + 回满 HP', parkedCharIds.length, moveProgress) }}
        </Button>
      </div>
    </template>
  </div>
</template>
