<script setup lang="ts">
import type { ActionTarget, ResistOutcome, ResistResult, ResistType } from '@/types/action'
import { computed } from 'vue'
import { resistLabels } from '@/core/combat/resist-text'

const props = defineProps<{
  charName: string
  defenseText?: string
  resistType: ResistType
  preview: string
  target: ActionTarget
  canApply: boolean
}>()

const emit = defineEmits<{
  (e: 'update:target', next: ActionTarget): void
  (e: 'apply'): void
}>()

const labels = computed(() => resistLabels(props.resistType))

function updateTarget(next: Partial<ActionTarget>) {
  emit('update:target', {
    ...props.target,
    ...next,
  })
}

function setResult(result: ResistResult) {
  updateTarget({
    resistResult: result,
    resistOutcome: result === 'success' ? (props.target.resistOutcome ?? 'half') : undefined,
  })
}

function setOutcome(outcome: ResistOutcome) {
  updateTarget({ resistOutcome: outcome })
}
</script>

<template>
  <div class="border border-white/10 rounded-md bg-white/5 p-2 text-xs">
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="truncate text-white font-medium">{{ charName }}</span>
      <span v-if="defenseText" class="text-white/50">
        {{ defenseText }}
      </span>
    </div>

    <div v-if="labels" class="mb-2 flex flex-wrap items-center gap-3 text-white/70">
      <label class="inline-flex items-center gap-1">
        <input
          type="radio"
          :checked="target.resistResult === 'success'"
          @change="setResult('success')"
        >
        <span>{{ labels.successLabel }}</span>
      </label>
      <label class="inline-flex items-center gap-1">
        <input
          type="radio"
          :checked="target.resistResult === 'failure'"
          @change="setResult('failure')"
        >
        <span>{{ labels.failureLabel }}</span>
      </label>
      <template v-if="target.resistResult === 'success'">
        <label class="inline-flex items-center gap-1">
          <input
            type="radio"
            :checked="(target.resistOutcome ?? 'half') === 'half'"
            @change="setOutcome('half')"
          >
          <span>半减</span>
        </label>
        <label class="inline-flex items-center gap-1">
          <input
            type="radio"
            :checked="target.resistOutcome === 'nullify'"
            @change="setOutcome('nullify')"
          >
          <span>无效</span>
        </label>
      </template>
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
