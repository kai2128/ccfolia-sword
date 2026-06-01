<script setup lang="ts">
// 逐格网格可见性选择器。本地 draft(隐藏格 Set),点「应用」才写 settings.gridHiddenCells。
// 表头列字母 / 行号供 GM 对照 H17 之类坐标;格内不塞文字(太挤),靠位置对应。
// 交互:点单格切换;按住拖拽矩形框选,框内统一设为「起手格切换后的目标态」。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Button, Dialog } from '@/components/ui'
import { cellKey, formatCol, formatHiddenCells, formatRow, parseHiddenCells } from '@/core/range'
import { useSettingsStore } from '@/stores/settings'

const open = defineModel<boolean>('open', { required: true })

const settings = useSettingsStore()
const cols = computed(() => settings.grid.cols)
const rows = computed(() => settings.grid.rows)

// 拖拽状态:起手格 + 当前格 + 目标态(true=设为可见,false=设为隐藏)。
const dragStart = ref<{ c: number, r: number } | null>(null)
const dragCurrent = ref<{ c: number, r: number } | null>(null)
const dragTarget = ref(true)

// 本地 draft:被隐藏格集合。打开时从 store 灌入。
const hidden = ref<Set<string>>(new Set())
watch(open, (v) => {
  if (v)
    hidden.value = parseHiddenCells(settings.gridHiddenCells)
  // 开关都重置拖拽态,防止关闭时未收到 pointerup 的残留泄漏到下次打开
  dragStart.value = null
  dragCurrent.value = null
})

function isVisible(c: number, r: number): boolean {
  return !hidden.value.has(cellKey(c, r))
}

// 当前预览矩形(拖拽中),用于高亮 + 落子。
const previewRect = computed(() => {
  if (!dragStart.value || !dragCurrent.value)
    return null
  const c0 = Math.min(dragStart.value.c, dragCurrent.value.c)
  const c1 = Math.max(dragStart.value.c, dragCurrent.value.c)
  const r0 = Math.min(dragStart.value.r, dragCurrent.value.r)
  const r1 = Math.max(dragStart.value.r, dragCurrent.value.r)
  return { c0, c1, r0, r1 }
})

function inPreview(c: number, r: number): boolean {
  const p = previewRect.value
  return !!p && c >= p.c0 && c <= p.c1 && r >= p.r0 && r <= p.r1
}

// 格子渲染态:拖拽中预览框内显示目标态,否则显示 draft 实际态。
function cellVisible(c: number, r: number): boolean {
  if (inPreview(c, r))
    return dragTarget.value
  return isVisible(c, r)
}

// 拖拽结束(松手/取消/窗口失焦兜底):commit 后摘掉 window 监听。
function endDrag() {
  commitDrag()
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

function onPointerDown(c: number, r: number, e: PointerEvent) {
  e.preventDefault()
  dragStart.value = { c, r }
  dragCurrent.value = { c, r }
  // 目标态 = 起手格当前态取反(可见->设隐藏 / 隐藏->设可见)
  dragTarget.value = !isVisible(c, r)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
})

function onPointerEnter(c: number, r: number) {
  if (dragStart.value)
    dragCurrent.value = { c, r }
}

function commitDrag() {
  const p = previewRect.value
  if (!p) {
    dragStart.value = null
    dragCurrent.value = null
    return
  }
  const next = new Set(hidden.value)
  for (let c = p.c0; c <= p.c1; c++) {
    for (let r = p.r0; r <= p.r1; r++) {
      const key = cellKey(c, r)
      if (dragTarget.value)
        next.delete(key) // 设为可见 = 从隐藏集移除
      else
        next.add(key) // 设为隐藏
    }
  }
  hidden.value = next
  dragStart.value = null
  dragCurrent.value = null
}

function selectAll() {
  hidden.value = new Set()
}

function selectNone() {
  const next = new Set<string>()
  for (let c = 0; c < cols.value; c++) {
    for (let r = 0; r < rows.value; r++)
      next.add(cellKey(c, r))
  }
  hidden.value = next
}

function invert() {
  const next = new Set<string>()
  for (let c = 0; c < cols.value; c++) {
    for (let r = 0; r < rows.value; r++) {
      const key = cellKey(c, r)
      if (!hidden.value.has(key))
        next.add(key)
    }
  }
  hidden.value = next
}

function apply() {
  settings.setGridHiddenCells(formatHiddenCells(hidden.value))
  open.value = false
}

const colHeaders = computed(() => Array.from({ length: cols.value }, (_, c) => formatCol(c)))
const rowHeaders = computed(() => Array.from({ length: rows.value }, (_, r) => formatRow(r)))
</script>

<template>
  <Dialog v-model:open="open" wide title="编辑网格可见区域">
    <div class="flex items-center gap-2">
      <Button size="sm" variant="ghost" @click="selectAll">
        全选
      </Button>
      <Button size="sm" variant="ghost" @click="selectNone">
        全不选
      </Button>
      <Button size="sm" variant="ghost" @click="invert">
        反选
      </Button>
    </div>

    <!-- 棋盘:左上角空位 + 顶部列表头 + 每行左侧行号 + 格按钮。整体可滚动。 -->
    <div
      class="max-h-[60vh] select-none overflow-auto"
    >
      <div
        class="grid gap-px"
        :style="{ gridTemplateColumns: `1.25rem repeat(${cols}, 1.1rem)` }"
      >
        <!-- 表头行:左上空 + 列字母 -->
        <div />
        <div
          v-for="(letter, c) in colHeaders"
          :key="`ch-${c}`"
          class="text-center text-[9px] text-white/50 leading-[1.1rem]"
        >
          {{ letter }}
        </div>

        <!-- 每一行:行号 + 该行所有格 -->
        <template v-for="(label, r) in rowHeaders" :key="`row-${r}`">
          <div class="pr-1 text-right text-[9px] text-white/50 leading-[1.1rem]">
            {{ label }}
          </div>
          <button
            v-for="(letter, c) in colHeaders"
            :key="`cell-${c}-${r}`"
            type="button"
            class="h-[1.1rem] w-[1.1rem] border rounded-[2px] transition-colors"
            :class="cellVisible(c, r)
              ? 'bg-accent/30 border-accent/60'
              : 'bg-white/5 border-white/10'"
            :title="`${letter}${label}`"
            @pointerdown="onPointerDown(c, r, $event)"
            @pointerenter="onPointerEnter(c, r)"
          />
        </template>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2 text-xs text-white/50">
      <span>点格切换,拖拽框选批量设置</span>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="ghost" @click="open = false">
          取消
        </Button>
        <Button size="sm" @click="apply">
          应用
        </Button>
      </div>
    </div>
  </Dialog>
</template>
