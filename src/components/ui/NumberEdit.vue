<script setup lang="ts">
// 通用紧凑数字编辑器:- / [value] / + 三件套,点中间数字进入 edit 模式接受表达式输入。
// 表达式 grammar(见 src/core/combat/eval-expr.ts):
//   17 / 2*5 / (1+2)*3   → absolute(覆盖)
//   +5 / -3 / +1*2-1     → delta(在当前值上加减)
//   =-5 / =10+5          → absolute(强制写,允许负)
// edit 模式上方浮出 [min] / [max] 快捷按钮:min 永远写 0,max 写 props.max(没传则不显示)。
// 不做任何 clamp:HP/MP 都允许越上下界,GM 可写 =-5 当负血,可写 =99 越级治疗。

import { nextTick, ref } from 'vue'
import { applyAdjustment } from '@/core/combat/eval-expr'

const props = defineProps<{
  value: number
  // 若定义,值显示成 "value/max" 且编辑模式上方有 [max] 按钮。
  max?: number
  step?: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', newValue: number): void
}>()

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

// Shift+click = 5,否则 = step (默认 1)
function bump(direction: 1 | -1, ev: MouseEvent) {
  const magnitude = ev.shiftKey ? 5 : (props.step ?? 1)
  const next = props.value + magnitude * direction
  if (next !== props.value)
    emit('change', next)
}

function startEdit() {
  if (props.disabled)
    return
  draft.value = ''
  editing.value = true
  nextTick(() => inputEl.value?.focus())
}

function commitEdit() {
  const next = applyAdjustment(draft.value, props.value)
  if (next !== null && next !== props.value)
    emit('change', next)
  editing.value = false
}

function cancelEdit() {
  editing.value = false
}

// 浮出按钮:跳过 input 解析直接 emit。mousedown.prevent 让 input 不失焦,
// 否则 blur 会先触发 commitEdit() 把空 draft 当成无效输入丢掉这次操作。
function setTo(v: number) {
  emit('change', v)
  editing.value = false
}

function onKey(ev: KeyboardEvent) {
  if (ev.key === 'Enter')
    commitEdit()
  else if (ev.key === 'Escape')
    cancelEdit()
}
</script>

<template>
  <div
    class="relative inline-flex items-center font-sans"
    :class="{ 'opacity-50': disabled }"
  >
    <button
      type="button"
      class="h-5 w-4 text-sm text-white/60 leading-none disabled:cursor-not-allowed hover:bg-white/10 hover:text-white"
      :disabled="disabled"
      title="-1(Shift+click 扣 5)"
      @click="ev => bump(-1, ev)"
    >
      -
    </button>

    <input
      v-if="editing"
      ref="inputEl"
      v-model="draft"
      class="h-5 w-14 border border-white/30 rounded bg-black/40 px-1 text-center text-xs text-white tabular-nums focus:border-accent placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-accent"
      :placeholder="`${value}${max !== undefined ? `/${max}` : ''}`"
      title="支持表达式:+5 / -3 / =10 / 1+2*3 / (1+2)*3"
      @keydown="onKey"
      @blur="commitEdit"
    >
    <button
      v-else
      type="button"
      class="min-w-10 px-1 text-center text-xs text-white leading-none tabular-nums disabled:cursor-not-allowed hover:underline"
      :disabled="disabled"
      title="点击进入编辑(支持表达式)"
      @click="startEdit"
    >
      {{ value }}<template v-if="max !== undefined">
        /{{ max }}
      </template>
    </button>

    <button
      type="button"
      class="h-5 w-4 text-sm text-white/60 leading-none disabled:cursor-not-allowed hover:bg-white/10 hover:text-white"
      :disabled="disabled"
      title="+1(Shift+click 加 5)"
      @click="ev => bump(1, ev)"
    >
      +
    </button>

    <!-- 编辑模式下浮出的 min/max 快捷条:绝对定位在 input 上方。
         min 永远 0;max 仅在 props.max 有值时显示。 -->
    <div
      v-if="editing"
      class="absolute bottom-full left-1/2 z-10 mb-0.5 flex gap-0.5 border border-white/15 rounded bg-black/85 px-0.5 py-0.5 -translate-x-1/2"
    >
      <button
        type="button"
        class="h-4 px-1 text-[10px] text-white/70 leading-none hover:bg-white/15 hover:text-white"
        title="设为 0"
        @mousedown.prevent="setTo(0)"
      >
        min
      </button>
      <button
        v-if="max !== undefined"
        type="button"
        class="h-4 px-1 text-[10px] text-white/70 leading-none hover:bg-white/15 hover:text-white"
        :title="`设为 ${max}`"
        @mousedown.prevent="setTo(max)"
      >
        max
      </button>
    </div>
  </div>
</template>
