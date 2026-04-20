<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from './Button.vue'
import Input from './Input.vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  placeholder?: string
  diePlaceholder1?: string
  diePlaceholder2?: string
  toggleLabel?: string
}>(), {
  disabled: false,
  placeholder: '总值',
  diePlaceholder1: '骰 1',
  diePlaceholder2: '骰 2',
  toggleLabel: '拆成两骰',
})

const model = defineModel<number | undefined>()

const expanded = ref(false)
const die1 = ref<string>('')
const die2 = ref<string>('')

function parseNumber(value: string | number | undefined): number | undefined {
  if (value === '' || value === undefined)
    return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const total = computed(() => {
  const a = parseNumber(die1.value)
  const b = parseNumber(die2.value)
  if (a === undefined || b === undefined)
    return undefined
  return a + b
})

watch(total, (value) => {
  if (expanded.value)
    model.value = value
})

function onSingleValueUpdate(value: string | number | undefined) {
  model.value = parseNumber(value)
}

function onDieUpdate(index: 1 | 2, value: string | number | undefined) {
  const normalized = value === undefined ? '' : String(value)
  if (index === 1)
    die1.value = normalized
  else
    die2.value = normalized
}

function toggleExpanded() {
  expanded.value = !expanded.value

  if (!expanded.value) {
    die1.value = ''
    die2.value = ''
    return
  }

  die1.value = ''
  die2.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <Input
        v-if="!expanded"
        type="number"
        :disabled="disabled"
        :placeholder="props.placeholder"
        :model-value="model ?? ''"
        @update:model-value="onSingleValueUpdate"
      />

      <div v-else class="grid grid-cols-[1fr_auto_1fr_auto] min-w-0 flex-1 items-center gap-2">
        <Input
          type="number"
          :disabled="disabled"
          :placeholder="props.diePlaceholder1"
          :model-value="die1"
          @update:model-value="value => onDieUpdate(1, value)"
        />
        <span class="text-sm text-white/40">+</span>
        <Input
          type="number"
          :disabled="disabled"
          :placeholder="props.diePlaceholder2"
          :model-value="die2"
          @update:model-value="value => onDieUpdate(2, value)"
        />
        <span class="min-w-12 text-right text-xs text-white/60 font-mono">
          = {{ total ?? '—' }}
        </span>
      </div>

      <Button
        size="sm"
        variant="ghost"
        :disabled="disabled"
        class="shrink-0"
        @click="toggleExpanded"
      >
        {{ expanded ? '单值' : props.toggleLabel }}
      </Button>
    </div>

    <div v-if="expanded" class="text-xs text-white/40">
      双骰模式下仅对外暴露两颗骰子的合计值。
    </div>
  </div>
</template>
