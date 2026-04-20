<script setup lang="ts">
// shadcn 风格 Select。Portal 目标走 usePortalTarget() —— 必须挂在 Shadow DOM
// 内,否则下拉菜单会被 ccfolia 的 light DOM 样式打穿。
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
import { usePortalTarget } from './portal'

defineProps<{
  placeholder?: string
  disabled?: boolean
  options?: Array<{ value: string, label: string }>
}>()

const model = defineModel<string>()
const target = usePortalTarget()
</script>

<template>
  <SelectRoot v-model="model" :disabled="disabled">
    <SelectTrigger
      class="h-8 w-full inline-flex items-center justify-between border border-white/20 rounded bg-black/30 px-2 text-sm text-white data-[placeholder]:text-white/40 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <SelectValue :placeholder="placeholder ?? '请选择…'" />
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
              v-for="opt in options"
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
