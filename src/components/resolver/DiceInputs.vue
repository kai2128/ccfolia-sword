<script setup lang="ts">
import type { ActionDraft } from '@/core/resolver/types'
import { computed } from 'vue'
import { Field, Input } from '@/components/ui'
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

    <div class="grid grid-cols-2 gap-2">
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
      <Field label="伤害" hint="查威力表后填入">
        <template #default="{ id }">
          <Input
            :id="id"
            type="number"
            :model-value="draft.rawDamage ?? ''"
            @update:model-value="value => patch('rawDamage', toNumberOrUndefined(value))"
          />
        </template>
      </Field>
    </div>
  </div>
</template>
