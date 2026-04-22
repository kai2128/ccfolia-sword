<script setup lang="ts">
import type { ActionTarget, ResistOutcome, ResistType } from '@/types/action'
import { computed } from 'vue'
import { resistLabels } from '@/core/combat/resist-text'

const props = defineProps<{
  charName: string
  defenseText?: string
  hitValueText?: string
  resistType: ResistType
  preview: string
  target: ActionTarget
  canApply: boolean
}>()

const emit = defineEmits<{
  (e: 'update:target', next: ActionTarget): void
  (e: 'apply'): void
  (e: 'remove'): void
}>()

const labels = computed(() => resistLabels(props.resistType))

const resistButtonText = computed(() => {
  if (!labels.value)
    return '—'
  if (props.target.resistResult === 'success')
    return labels.value.successLabel
  if (props.target.resistResult === 'failure')
    return labels.value.failureLabel
  return '待定'
})

// 绿色 = 对防守方有利(未命中/抵抗成功);红色 = 命中/抵抗失败;灰色 = 未裁决。
const resistButtonClass = computed(() => {
  if (props.target.resistResult === undefined)
    return 'bg-white/5 text-white/70 hover:bg-white/10'
  if (props.target.resistResult === 'success')
    return 'bg-buff/15 text-buff'
  return 'bg-hp/15 text-hp'
})

const outcomeText = computed(() =>
  (props.target.resistOutcome ?? 'half') === 'half' ? '半减' : '无效',
)

function updateTarget(next: Partial<ActionTarget>) {
  emit('update:target', { ...props.target, ...next })
}

function cycleResult() {
  const current = props.target.resistResult
  if (current === undefined) {
    updateTarget({
      resistResult: 'success',
      resistOutcome: props.target.resistOutcome ?? 'half',
    })
    return
  }
  if (current === 'success') {
    updateTarget({ resistResult: 'failure', resistOutcome: undefined })
    return
  }
  updateTarget({ resistResult: undefined, resistOutcome: undefined })
}

function cycleOutcome() {
  if (props.target.resistResult !== 'success')
    return
  const next: ResistOutcome = (props.target.resistOutcome ?? 'half') === 'half' ? 'nullify' : 'half'
  updateTarget({ resistOutcome: next })
}
</script>

<template>
  <div class="rounded bg-black/20 p-2 text-xs">
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="truncate text-white font-medium">{{ charName }}</span>
      <div class="flex shrink-0 items-center gap-2">
        <span v-if="defenseText || hitValueText" class="flex items-center gap-2 text-white/50">
          <span v-if="hitValueText" class="text-accent/70">{{ hitValueText }}</span>
          <span v-if="defenseText">{{ defenseText }}</span>
        </span>
        <button
          type="button"
          class="h-6 w-6 rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          title="移除目标"
          @click="emit('remove')"
        >
          ×
        </button>
      </div>
    </div>

    <div v-if="labels" class="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="h-7 rounded px-2 transition-colors"
        :class="resistButtonClass"
        :title="target.resistResult === undefined ? '点击循环:待定 → 成功 → 失败 → 待定' : '已标记,继续点击切换或清除'"
        @click="cycleResult"
      >
        {{ resistButtonText }}
      </button>
      <button
        v-if="target.resistResult === 'success'"
        type="button"
        class="h-7 rounded bg-white/5 px-2 text-white/80 transition-colors hover:bg-white/10"
        title="点击切换 半减/无效"
        @click="cycleOutcome"
      >
        {{ outcomeText }}
      </button>
    </div>

    <div class="flex items-center justify-between gap-2">
      <span class="text-accent font-mono">→ {{ preview }}</span>
      <button
        type="button"
        class="h-7 rounded bg-accent/80 px-2 text-white transition-colors disabled:cursor-not-allowed hover:bg-accent disabled:opacity-40"
        :disabled="!canApply"
        @click="emit('apply')"
      >
        应用
      </button>
    </div>
  </div>
</template>
