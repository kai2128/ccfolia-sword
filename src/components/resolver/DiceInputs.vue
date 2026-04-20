<script setup lang="ts">
import type { ActionDraft } from '@/core/resolver/types'
import { computed } from 'vue'
import { Button, Field, Input } from '@/components/ui'
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

function updateCrit(index: number, part: 0 | 1, value: string | number | undefined) {
  const current = draft.value.critDice[index]
  if (!current)
    return

  const parsed = toNumberOrUndefined(value)
  if (parsed === undefined) {
    // CritRoll 类型不允许半空状态，用户清空任一格时直接移除整条。
    resolver.removeCritRoll(index)
    return
  }

  const next: [number, number] = [...current] as [number, number]
  next[part] = parsed
  resolver.updateCritRoll(index, next)
}

function addCrit() {
  resolver.addCritRoll([1, 1])
}

function patchRoll(value: string | number | undefined) {
  const parsed = toNumberOrUndefined(value)
  if (draft.value.kind === 'physical')
    patch('attackRoll', parsed)
  else
    patch('castingRoll', parsed)
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
    <div class="text-xs text-white/60 font-medium">
      骰子
    </div>

    <Field :label="draft.kind === 'physical' ? '命中值' : '行使值'">
      <template #default="{ id }">
        <Input
          :id="id"
          type="number"
          :model-value="draft.kind === 'physical' ? draft.attackRoll ?? '' : draft.castingRoll ?? ''"
          @update:model-value="patchRoll"
        />
      </template>
    </Field>

    <div class="grid grid-cols-2 gap-2">
      <Field label="伤害骰 1">
        <template #default="{ id }">
          <Input
            :id="id"
            type="number"
            :model-value="draft.dice1 ?? ''"
            @update:model-value="value => patch('dice1', toNumberOrUndefined(value))"
          />
        </template>
      </Field>
      <Field label="伤害骰 2">
        <template #default="{ id }">
          <Input
            :id="id"
            type="number"
            :model-value="draft.dice2 ?? ''"
            @update:model-value="value => patch('dice2', toNumberOrUndefined(value))"
          />
        </template>
      </Field>
    </div>

    <div class="flex items-center justify-between">
      <div class="text-xs text-white/60 font-medium">
        暴击累加骰
      </div>
      <Button size="sm" variant="ghost" @click="addCrit()">
        + 追加
      </Button>
    </div>

    <div v-if="draft.critDice.length === 0" class="text-xs text-white/40">
      尚未追加暴击骰
    </div>
    <div v-else class="text-xs text-white/40">
      清空任一骰值会移除该条暴击骰
    </div>

    <div
      v-for="(pair, index) in draft.critDice"
      :key="index"
      class="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2"
    >
      <span class="pb-2 text-xs text-white/60">暴 {{ index + 1 }}</span>
      <Field label="骰 1">
        <template #default="{ id }">
          <Input
            :id="id"
            type="number"
            :model-value="pair[0]"
            @update:model-value="value => updateCrit(index, 0, value)"
          />
        </template>
      </Field>
      <Field label="骰 2">
        <template #default="{ id }">
          <Input
            :id="id"
            type="number"
            :model-value="pair[1]"
            @update:model-value="value => updateCrit(index, 1, value)"
          />
        </template>
      </Field>
      <Button size="sm" variant="ghost" class="mb-1" @click="resolver.removeCritRoll(index)">
        移除
      </Button>
    </div>
  </div>
</template>
