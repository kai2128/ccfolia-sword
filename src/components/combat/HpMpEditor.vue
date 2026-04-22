<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { parseAdjustment, resolveNewValue } from '@/core/combat/adjust-hp-mp'

const props = withDefaults(defineProps<{
  kind: 'hp' | 'mp'
  value: number
  max: number
  step?: number
  disabled?: boolean
  /** 为 true 时不允许超过 max(溢出治疗/buff 会被截断);默认 false */
  clampMax?: boolean
}>(), {
  clampMax: false,
})

const emit = defineEmits<{
  (e: 'change', newValue: number): void
}>()

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

// 单一点击入口:Shift+click = 5,否则 = step (默认 1)。
// 不能同时写 @click 和 @click.shift.exact,因为 .exact 只限制修饰键白名单,
// 普通 @click 会在 shift+click 时也触发,造成重复写入。
function bump(direction: 1 | -1, ev: MouseEvent) {
  const magnitude = ev.shiftKey ? 5 : (props.step ?? 1)
  const delta = magnitude * direction
  const adj = { kind: 'delta' as const, value: delta }
  const next = resolveNewValue(adj, props.value, props.max, props.kind, { clampMax: props.clampMax })
  if (next !== props.value)
    emit('change', next)
}

function startEdit() {
  if (props.disabled)
    return
  draft.value = ''
  editing.value = true
  // 等 v-if 渲染出 input 之后再聚焦
  nextTick(() => {
    inputEl.value?.focus()
  })
}

function commitEdit() {
  const adj = parseAdjustment(draft.value)
  if (adj) {
    const next = resolveNewValue(adj, props.value, props.max, props.kind, { clampMax: props.clampMax })
    if (next !== props.value)
      emit('change', next)
  }
  editing.value = false
}

function cancelEdit() {
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
    class="inline-flex items-center gap-0.5 font-sans"
    :class="{ 'opacity-50': disabled }"
  >
    <button
      class="h-5 w-5 border border-white/30 bg-transparent text-white leading-none disabled:cursor-not-allowed hover:bg-white/10"
      :disabled="disabled"
      @click="ev => bump(-1, ev)"
    >
      -
    </button>
    <input
      v-if="editing"
      ref="inputEl"
      v-model="draft"
      class="h-5 w-20 border border-white/30 rounded bg-black/40 px-1 text-center text-xs text-white tabular-nums focus:border-accent placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-accent"
      placeholder="17 或 +5"
      title="输入格式:&#10;  数字     设为该值(例如 17)&#10;  +N / -N  在当前值上增减&#10;  =N      强制设为 N(可为负)"
      @keydown="onKey"
      @blur="commitEdit"
    >
    <button
      v-else
      class="min-w-13 border-none bg-transparent text-center text-white tabular-nums disabled:cursor-not-allowed hover:underline"
      :disabled="disabled"
      @click="startEdit"
    >
      {{ value }}/{{ max }}
    </button>
    <button
      class="h-5 w-5 border border-white/30 bg-transparent text-white leading-none disabled:cursor-not-allowed hover:bg-white/10"
      :disabled="disabled"
      @click="ev => bump(1, ev)"
    >
      +
    </button>
  </div>
</template>
