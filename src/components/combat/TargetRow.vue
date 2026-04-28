<script setup lang="ts">
import type { ActionTarget, ResistOutcome, ResistType } from '@/types/action'
import { computed } from 'vue'
import NumberEdit from '@/components/ui/NumberEdit.vue'
import { resistLabels } from '@/core/combat/resist-text'

const props = defineProps<{
  charName: string
  defenseText?: string
  hitValueText?: string
  resistType: ResistType
  preview: string
  // 当前公式算出来的最终伤害/治疗值;为 null 时(待裁决/缺 HP/异常)只显示 preview 文本
  finalValue: number | null
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

const hasOverride = computed(() => props.target.finalValueOverride !== undefined)

// NumberEdit 显示的数字:override 优先,否则用公式算出的 finalValue
const editableFinal = computed(() => props.target.finalValueOverride ?? props.finalValue ?? 0)

// 改 final 数字 = 写 finalValueOverride;非负截 0
function onFinalChange(next: number) {
  updateTarget({ finalValueOverride: Math.max(0, Math.floor(next)) })
}

const hasManualMods = computed(() =>
  hasOverride.value
  || (props.target.bonus ?? 0) !== 0
  || (props.target.penalty ?? 0) !== 0,
)

// 一键清空所有手改项:override + 加值 + 减值
function clearOverride() {
  updateTarget({ finalValueOverride: undefined, bonus: undefined, penalty: undefined })
}

function onBonusInput(ev: Event) {
  const raw = (ev.target as HTMLInputElement).value
  const n = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)))
  updateTarget({ bonus: n || undefined })
}

function onPenaltyInput(ev: Event) {
  const raw = (ev.target as HTMLInputElement).value
  const n = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)))
  updateTarget({ penalty: n || undefined })
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

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-white/70">
        <label class="inline-flex items-center gap-1" title="加值:叠加到最终伤害/治疗">
          <span class="text-buff/80">+加</span>
          <input
            type="number"
            min="0"
            step="1"
            :value="target.bonus ?? 0"
            class="w-12 border border-white/10 rounded bg-surface px-1 py-0.5 text-center text-white"
            @input="onBonusInput"
          >
        </label>
        <label class="inline-flex items-center gap-1" title="减值:从最终伤害/治疗里扣除">
          <span class="text-hp/80">−减</span>
          <input
            type="number"
            min="0"
            step="1"
            :value="target.penalty ?? 0"
            class="w-12 border border-white/10 rounded bg-surface px-1 py-0.5 text-center text-white"
            @input="onPenaltyInput"
          >
        </label>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-accent">→</span>
        <template v-if="finalValue !== null || hasOverride">
          <NumberEdit
            :value="editableFinal"
            :disabled="!canApply && !hasOverride"
            @change="onFinalChange"
          />
          <button
            type="button"
            class="h-6 w-6 rounded text-white/40 transition-colors disabled:cursor-not-allowed hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/40"
            :disabled="!hasManualMods"
            title="重置:清空 加值 / 减值 / 手改 final,回到公式"
            @click="clearOverride"
          >
            ↺
          </button>
        </template>
        <span v-else class="text-accent font-mono">{{ preview }}</span>
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
  </div>
</template>
