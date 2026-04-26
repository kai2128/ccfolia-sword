<script setup lang="ts">
// 紧凑格位编辑器:非编辑态显示 "5J"(板外为"板外"),点击进入编辑。
// 编辑态:input 接受多种写法,周围浮出 ▲▼◀▶ 做相对移动,Shift+click 在方向键上 ×5。
// 输入语法(commit 时按顺序尝试):
//   "u10" / "d3" / "l2" / "r5"   方向字母 + 正整数,emit move
//   "+2,-3" / "2,-3"             dRow,dCol 双轴 delta,emit move
//   "5J"                          绝对格位,emit submit
//
// 组件不知道 grid、不读 firestore —— 只 emit 语义,父组件分流到 setCharacterCell / moveCharacterByCells。

import { nextTick, ref } from 'vue'
import { parseCellDelta } from '@/core/range'

const props = defineProps<{
  cell: string
  offBoard: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', raw: string): void
  (e: 'move', delta: { dx: number, dy: number }): void
}>()

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

function startEdit() {
  if (props.disabled)
    return
  // draft 留空,placeholder 显示当前 cell。这样 commit 时空 draft = no-op,
  // 不会因为方向键期间 props.cell 已经变了、draft 还停在旧值,而把角色弹回原位。
  draft.value = ''
  editing.value = true
  nextTick(() => inputEl.value?.focus())
}

function commitEdit() {
  // Enter 会先 commit 把 editing 置 false → input 被 v-if 摘掉 → 浏览器对刚卸载的
  // input 再 fire 一次 blur → 又触发 commitEdit。没有这个 guard 的话 "d1" 会走两次,
  // 角色被移动两格。
  if (!editing.value)
    return
  editing.value = false
  const raw = draft.value.trim()
  if (!raw)
    return
  const delta = parseCellDelta(raw)
  if (delta)
    emit('move', delta)
  else
    emit('submit', raw)
}

function cancelEdit() {
  editing.value = false
}

// 方向键:Shift+click ×5,和 NumberEdit 的手感对齐。
function move(dx: number, dy: number, ev: MouseEvent) {
  if (props.offBoard)
    return
  const m = ev.shiftKey ? 5 : 1
  emit('move', { dx: dx * m, dy: dy * m })
}

function onKey(ev: KeyboardEvent) {
  if (ev.key === 'Enter')
    commitEdit()
  else if (ev.key === 'Escape')
    cancelEdit()
}
</script>

<template>
  <div class="relative inline-flex items-center">
    <input
      v-if="editing"
      ref="inputEl"
      v-model="draft"
      type="text"
      :placeholder="cell || '板外'"
      class="h-5 w-12 shrink-0 border border-accent rounded bg-black/40 px-1 text-center text-xs text-white tabular-nums placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-accent"
      title="5J 绝对 / u10 d3 l2 r5 / +2,-3 (dRow,dCol)"
      @keydown="onKey"
      @blur="commitEdit"
    >
    <button
      v-else
      type="button"
      class="h-5 w-12 shrink-0 border border-white/20 rounded bg-black/30 px-1 text-center text-xs tabular-nums hover:bg-black/50 focus:outline-none focus:ring-1 focus:ring-accent"
      :class="cell ? 'text-white' : 'text-white/40'"
      :disabled="disabled"
      :title="cell ? `当前 ${cell},点击编辑/移动` : '板外,点击输入格位拉回'"
      @click="startEdit"
    >
      {{ cell || '板外' }}
    </button>

    <!-- 编辑态:十字方向键浮在 input 周围。@mousedown.prevent 保住 input focus,
         否则 blur 会先 commit 把面板收掉。 -->
    <template v-if="editing">
      <button
        type="button"
        class="absolute bottom-full left-1/2 z-10 mb-0.5 h-4 w-5 flex items-center justify-center border border-white/20 rounded bg-black/85 text-[10px] text-white/70 leading-none -translate-x-1/2 hover:bg-white/15 hover:text-white disabled:opacity-30"
        :disabled="offBoard"
        title="上 1 格(Shift+click ×5)"
        @mousedown.prevent="move(0, -1, $event)"
      >
        ▲
      </button>
      <button
        type="button"
        class="absolute left-1/2 top-full z-10 mt-0.5 h-4 w-5 flex items-center justify-center border border-white/20 rounded bg-black/85 text-[10px] text-white/70 leading-none -translate-x-1/2 hover:bg-white/15 hover:text-white disabled:opacity-30"
        :disabled="offBoard"
        title="下 1 格(Shift+click ×5)"
        @mousedown.prevent="move(0, 1, $event)"
      >
        ▼
      </button>
      <button
        type="button"
        class="absolute right-full top-1/2 z-10 mr-0.5 h-4 w-4 flex items-center justify-center border border-white/20 rounded bg-black/85 text-[10px] text-white/70 leading-none -translate-y-1/2 hover:bg-white/15 hover:text-white disabled:opacity-30"
        :disabled="offBoard"
        title="左 1 格(Shift+click ×5)"
        @mousedown.prevent="move(-1, 0, $event)"
      >
        ◀
      </button>
      <button
        type="button"
        class="absolute left-full top-1/2 z-10 ml-0.5 h-4 w-4 flex items-center justify-center border border-white/20 rounded bg-black/85 text-[10px] text-white/70 leading-none -translate-y-1/2 hover:bg-white/15 hover:text-white disabled:opacity-30"
        :disabled="offBoard"
        title="右 1 格(Shift+click ×5)"
        @mousedown.prevent="move(1, 0, $event)"
      >
        ▶
      </button>
    </template>
  </div>
</template>
