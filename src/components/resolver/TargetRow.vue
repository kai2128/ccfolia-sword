<script setup lang="ts">
import type { ActionKind, ResolvedTarget, Target } from '@/core/resolver/types'
import { computed } from 'vue'
import { Button, Input } from '@/components/ui'
import { useResolverStore } from '@/stores/resolver'

const props = defineProps<{
  target: Target
  resolved: ResolvedTarget
  kind: ActionKind
}>()

const resolver = useResolverStore()

function patch(patchValue: Partial<Target>) {
  resolver.patchTarget(props.target.id, patchValue)
}

function toNumberOrUndefined(value: string | number | undefined): number | undefined {
  if (value === '' || value === undefined)
    return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const hitText = computed(() => {
  if (props.kind === 'physical') {
    if (props.resolved.hit === true)
      return '命中'
    if (props.resolved.hit === false)
      return '未中'
    return '待定'
  }

  if (props.resolved.hit === true)
    return '失败'
  if (props.resolved.hit === false)
    return '成功'
  return '待定'
})

function cycleHitOverride() {
  const current = props.target.hitOverride
  if (current === undefined) {
    patch({ hitOverride: true })
    return
  }
  if (current === true) {
    patch({ hitOverride: false })
    return
  }
  patch({ hitOverride: undefined })
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded bg-black/20 p-2 text-xs">
    <div class="flex items-center gap-2">
      <Input
        class="min-w-0 flex-1"
        placeholder="目标名"
        :model-value="target.name"
        @update:model-value="value => patch({ name: value as string })"
      />

      <button
        type="button"
        class="h-8 shrink-0 rounded px-2 transition-colors"
        :class="props.resolved.isHitOverridden ? 'bg-accent/15 text-accent' : 'bg-white/5 text-white/70 hover:bg-white/10'"
        :title="props.resolved.isHitOverridden ? '已覆盖，点击切换或清除' : '点击循环切换覆盖值'"
        @click="cycleHitOverride"
      >
        {{ hitText }}
      </button>

      <Button size="sm" variant="ghost" class="shrink-0" @click="resolver.removeTarget(target.id)">
        ×
      </Button>
    </div>

    <div v-if="kind === 'physical'" class="grid grid-cols-2 gap-2">
      <label class="min-w-0 flex flex-col gap-1">
        <span class="text-white/40">回避</span>
        <Input
          type="number"
          placeholder="回避"
          :model-value="target.evasion ?? ''"
          @update:model-value="value => patch({ evasion: toNumberOrUndefined(value) })"
        />
      </label>

      <label class="min-w-0 flex flex-col gap-1">
        <span class="text-white/40">防御</span>
        <Input
          type="number"
          placeholder="防御"
          :model-value="target.defense ?? ''"
          @update:model-value="value => patch({ defense: toNumberOrUndefined(value) })"
        />
      </label>
    </div>

    <div v-else class="grid grid-cols-1 gap-2">
      <label class="min-w-0 flex flex-col gap-1">
        <span class="text-white/40">抵抗</span>
        <Input
          type="number"
          placeholder="抵抗"
          :model-value="target.resistValue ?? ''"
          @update:model-value="value => patch({ resistValue: toNumberOrUndefined(value) })"
        />
      </label>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="min-w-0 flex flex-col gap-1">
        <span class="text-white/40">原伤害</span>
        <div class="min-w-0 flex items-center gap-1">
          <Input
            type="number"
            placeholder="原伤害"
            :model-value="target.rawDamageOverride ?? (resolved.rawDamage ?? '')"
            :class="resolved.isRawDamageOverridden ? 'text-accent' : ''"
            :title="resolved.isRawDamageOverridden ? '当前为手动覆盖值' : '当前显示自动计算值；输入后转为手动覆盖'"
            @update:model-value="value => patch({ rawDamageOverride: toNumberOrUndefined(value) })"
          />
          <button
            v-if="resolved.isRawDamageOverridden"
            type="button"
            class="i-lucide-rotate-ccw shrink-0 text-3 text-accent"
            title="恢复自动原伤害"
            @click="patch({ rawDamageOverride: undefined })"
          />
        </div>
      </label>

      <label class="min-w-0 flex flex-col gap-1">
        <span class="text-white/40">最终</span>
        <div class="min-w-0 flex items-center gap-1">
          <Input
            type="number"
            placeholder="最终"
            :model-value="target.finalDamageOverride ?? (resolved.finalDamage ?? '')"
            :class="resolved.isFinalDamageOverridden ? 'text-accent font-bold' : 'font-bold'"
            :title="resolved.isFinalDamageOverridden ? '当前为手动覆盖值' : '当前显示自动计算值；输入后转为手动覆盖'"
            @update:model-value="value => patch({ finalDamageOverride: toNumberOrUndefined(value) })"
          />
          <button
            v-if="resolved.isFinalDamageOverridden"
            type="button"
            class="i-lucide-rotate-ccw shrink-0 text-3 text-accent"
            title="恢复自动最终伤害"
            @click="patch({ finalDamageOverride: undefined })"
          />
        </div>
      </label>
    </div>
  </div>
</template>
