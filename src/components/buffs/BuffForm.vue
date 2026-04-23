<script setup lang="ts">
import type { BuffFormState } from '@/core/buff/form-helpers'
import { computed } from 'vue'
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ui'

defineProps<{
  showSaveToLibrary?: boolean
}>()

const model = defineModel<BuffFormState>({ required: true })
const saveToLibrary = defineModel<boolean>('saveToLibrary', { default: false })

const isPositive = computed({
  get: () => model.value.polarity === 'positive',
  set: (v: boolean) => {
    model.value = { ...model.value, polarity: v ? 'positive' : 'negative' }
  },
})

const scopeOptions = [
  { value: 'single', label: '单体' },
  { value: 'aoe', label: 'AoE' },
]

const isAoe = computed(() => model.value.scope === 'aoe')
</script>

<template>
  <div class="flex flex-col gap-3">
    <Field label="名字">
      <Input v-model="model.name" placeholder="灼烧" />
    </Field>

    <Field label="描述">
      <Textarea v-model="model.description" rows="3" placeholder="描述效果,例如:每回合受 1d6 火焰伤害" />
    </Field>

    <div class="grid grid-cols-2 gap-2">
      <Field label="持续回合" hint="留空 = 手动移除">
        <Input v-model.number="model.turnsRemaining" type="number" min="0" />
      </Field>
      <Field label="行使值" hint="可选,例如技能成功率">
        <Input v-model.number="model.actionValue" type="number" min="0" placeholder="留空" />
      </Field>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <Field label="性质">
        <div class="h-8 flex items-center gap-2">
          <Switch v-model="isPositive" />
          <span class="text-xs text-white/80">{{ isPositive ? '正面' : '负面' }}</span>
        </div>
      </Field>
      <Field label="图标" hint="留空 fallback i-mdi-star">
        <Input v-model="model.icon" placeholder="i-mdi-fire 或 🔥" />
      </Field>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <Field label="范围">
        <Select v-model="model.scope" :options="scopeOptions" />
      </Field>
      <Field v-if="isAoe" label="AoE 半径" hint="格=米">
        <Input v-model.number="model.aoeRadius" type="number" min="1" placeholder="2" />
      </Field>
    </div>

    <label v-if="showSaveToLibrary" class="flex items-center gap-2 text-xs text-white/80">
      <Button
        type="button" size="xs" :variant="saveToLibrary ? 'solid' : 'ghost'"
        @click="saveToLibrary = !saveToLibrary"
      >
        <span :class="saveToLibrary ? 'i-lucide-check' : 'i-lucide-square'" class="text-3.5" />
      </Button>
      保存到 buff 库
    </label>
  </div>
</template>
