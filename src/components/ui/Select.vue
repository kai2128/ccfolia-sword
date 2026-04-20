<script setup lang="ts">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
// shadcn 风格 Select。Portal 目标走 usePortalTarget() —— 必须挂在 Shadow DOM
// 内,否则下拉菜单会被 ccfolia 的 light DOM 样式打穿。
import { computed } from 'vue'
import { usePortalTarget } from './portal'

const props = defineProps<{
  placeholder?: string
  disabled?: boolean
  options?: Array<{ value: string, label: string }>
}>()

const model = defineModel<string>()
const target = usePortalTarget()
const EMPTY_VALUE_SENTINEL = '__ccs_select_empty__'

const localModel = computed({
  get() {
    return model.value === '' ? EMPTY_VALUE_SENTINEL : model.value
  },
  set(value: string | undefined) {
    model.value = value === EMPTY_VALUE_SENTINEL ? '' : value
  },
})

const normalizedOptions = computed(() => {
  return (props.options ?? []).map(option => ({
    ...option,
    value: option.value === '' ? EMPTY_VALUE_SENTINEL : option.value,
  }))
})
</script>

<template>
  <SelectRoot v-model="localModel" :disabled="disabled">
    <SelectTrigger
      class="h-8 w-full inline-flex items-center justify-between border border-white/20 rounded bg-black/30 px-2 text-sm text-white disabled:cursor-not-allowed data-[placeholder]:text-white/40 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <SelectValue :placeholder="props.placeholder ?? '请选择…'" />
      <SelectIcon><div class="i-lucide-chevron-down text-3" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal :to="target ?? undefined">
      <SelectContent
        class="overflow-hidden border border-white/10 rounded bg-surface text-white shadow-xl"
        position="popper"
        :side-offset="4"
      >
        <SelectViewport class="p-1">
          <slot>
            <SelectItem
              v-for="opt in normalizedOptions"
              :key="opt.value"
              :value="opt.value"
              class="h-7 flex items-center justify-between rounded px-2 text-sm data-[highlighted]:bg-white/10 data-[highlighted]:outline-none"
            >
              <SelectItemText>{{ opt.label }}</SelectItemText>
              <SelectItemIndicator>
                <div class="i-lucide-check text-3" />
              </SelectItemIndicator>
            </SelectItem>
          </slot>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
