<script setup lang="ts">
import type { ActionDraft, ActionKind, ResistOutcome, ResistTarget } from '@/core/resolver/types'
import { computed } from 'vue'
import { Field, Input, Select, Switch } from '@/components/ui'
import { useResolverStore } from '@/stores/resolver'

const resolver = useResolverStore()

const draft = computed<ActionDraft>(() => resolver.draft!)

function patch<K extends keyof ActionDraft>(key: K, value: ActionDraft[K]) {
  resolver.patchDraft({ [key]: value } as Pick<ActionDraft, K>)
}

function toNumberOrUndefined(value: string | number | undefined): number | undefined {
  if (value === '' || value === undefined)
    return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const kindOptions: Array<{ value: ActionKind, label: string }> = [
  { value: 'physical', label: '物理' },
  { value: 'magic', label: '魔法' },
]

const resistTargetOptions: Array<{ value: ResistTarget, label: string }> = [
  { value: 'life', label: '生命抵抗' },
  { value: 'mental', label: '精神抵抗' },
]

const resistOutcomeOptions: Array<{ value: ResistOutcome, label: string }> = [
  { value: 'nullify', label: '无效' },
  { value: 'half', label: '半伤' },
]
</script>

<template>
  <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
    <div class="text-xs text-white/60 font-medium">
      行动头
    </div>

    <div class="grid grid-cols-2 gap-2">
      <Field label="类型">
        <Select
          :model-value="draft.kind"
          :options="kindOptions"
          @update:model-value="value => patch('kind', value as ActionKind)"
        />
      </Field>
      <Field label="攻击者">
        <template #default="{ id }">
          <Input
            :id="id"
            :model-value="draft.attacker"
            placeholder="格伦"
            @update:model-value="value => patch('attacker', value as string)"
          />
        </template>
      </Field>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <Field label="行动名">
        <template #default="{ id }">
          <Input
            :id="id"
            :model-value="draft.actionName"
            placeholder="长剑挥砍"
            @update:model-value="value => patch('actionName', value as string)"
          />
        </template>
      </Field>
      <Field label="射程">
        <template #default="{ id }">
          <Input
            :id="id"
            :model-value="draft.range"
            placeholder="纯文字提醒"
            @update:model-value="value => patch('range', value as string)"
          />
        </template>
      </Field>
    </div>

    <div class="flex items-center gap-2">
      <label class="flex items-center gap-2 text-xs text-white/70">
        <Switch
          :model-value="draft.isAoe"
          @update:model-value="value => patch('isAoe', value ?? false)"
        />
        AoE
      </label>
      <Input
        v-if="draft.isAoe"
        class="flex-1"
        :model-value="draft.aoeNote"
        placeholder="如 3m 半径"
        @update:model-value="value => patch('aoeNote', value as string)"
      />
    </div>

    <div v-if="draft.kind === 'magic'" class="grid grid-cols-2 gap-2 rounded bg-black/20 p-2">
      <Field label="抵抗类型">
        <Select
          :model-value="draft.resistTarget ?? 'mental'"
          :options="resistTargetOptions"
          @update:model-value="value => patch('resistTarget', value as ResistTarget)"
        />
      </Field>
      <Field label="抵抗后果">
        <Select
          :model-value="draft.resistOutcome"
          :options="resistOutcomeOptions"
          @update:model-value="value => patch('resistOutcome', value as ResistOutcome)"
        />
      </Field>
      <Field label="MP 消耗" hint="仅提示，不自动扣除">
        <template #default="{ id }">
          <Input
            :id="id"
            type="number"
            :model-value="draft.mpCost ?? ''"
            @update:model-value="value => patch('mpCost', toNumberOrUndefined(value))"
          />
        </template>
      </Field>
    </div>
  </div>
</template>
