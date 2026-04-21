<script setup lang="ts">
import type { StatusSlot } from '@/core/status-slot'
import { ref } from 'vue'
import { parseAdjustment, resolveNewValue } from '@/core/combat/adjust-hp-mp'

const props = defineProps<{
  kind: 'hp' | 'mp'
  slot: StatusSlot
  value: number
  max: number
  step?: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', newValue: number): void
}>()

const editing = ref(false)
const draft = ref('')

// 单一点击入口:Shift+click = 5,否则 = step (默认 1)。
// 不能同时写 @click 和 @click.shift.exact,因为 .exact 只限制修饰键白名单,
// 普通 @click 会在 shift+click 时也触发,造成重复写入。
function bump(direction: 1 | -1, ev: MouseEvent) {
  const magnitude = ev.shiftKey ? 5 : (props.step ?? 1)
  const delta = magnitude * direction
  const adj = { kind: 'delta' as const, value: delta }
  const next = resolveNewValue(adj, props.value, props.max, props.kind)
  if (next !== props.value)
    emit('change', next)
}

function startEdit() {
  if (props.disabled)
    return
  draft.value = ''
  editing.value = true
}

function commitEdit() {
  const adj = parseAdjustment(draft.value)
  if (adj) {
    const next = resolveNewValue(adj, props.value, props.max, props.kind)
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
  <div class="hp-mp-editor" :class="{ disabled }">
    <button
      class="step"
      :disabled="disabled"
      @click="ev => bump(-1, ev)"
    >
      -
    </button>
    <input
      v-if="editing"
      v-model="draft"
      class="inline-input"
      placeholder="17 / +5 / -3"
      @keydown="onKey"
      @blur="commitEdit"
    >
    <button v-else class="text" :disabled="disabled" @click="startEdit">
      {{ value }}/{{ max }}
    </button>
    <button
      class="step"
      :disabled="disabled"
      @click="ev => bump(1, ev)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.hp-mp-editor {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: system-ui, sans-serif;
}
.hp-mp-editor.disabled {
  opacity: 0.5;
}
.step {
  width: 20px;
  height: 20px;
  border: 1px solid #999;
  background: transparent;
  cursor: pointer;
  line-height: 1;
}
.step:disabled {
  cursor: not-allowed;
}
.text {
  min-width: 52px;
  text-align: center;
  border: none;
  background: transparent;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.inline-input {
  width: 64px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
