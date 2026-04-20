<script setup lang="ts">
import type { Resolution } from '@/core/resolver/types'
import { computed } from 'vue'
import { Button } from '@/components/ui'
import { useResolverStore } from '@/stores/resolver'
import TargetRow from './TargetRow.vue'

const resolver = useResolverStore()
const resolution = computed<Resolution>(() => resolver.resolution!)
const draft = computed(() => resolver.draft!)

const rows = computed(() => {
  const resolvedMap = new Map(resolution.value.targets.map(target => [target.id, target]))
  return draft.value.targets.map(target => ({
    target,
    resolved: resolvedMap.get(target.id)!,
  }))
})
</script>

<template>
  <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0 text-xs text-white/60 font-medium">
        目标
        <span class="break-all text-white/40">
          · {{ draft.range || '未填射程' }}{{ draft.isAoe ? ` / AoE ${draft.aoeNote || '未填范围'}` : '' }}
        </span>
      </div>
      <Button size="sm" @click="resolver.addTarget()">
        + 添加目标
      </Button>
    </div>

    <div v-if="rows.length === 0" class="rounded bg-black/20 py-3 text-center text-xs text-white/40">
      还没有目标
    </div>

    <TargetRow
      v-for="row in rows"
      :key="row.target.id"
      :target="row.target"
      :resolved="row.resolved"
      :kind="draft.kind"
    />

    <div v-if="resolution.parseError" class="text-xs text-hp">
      公式错误：{{ resolution.parseError }}
    </div>
  </div>
</template>
