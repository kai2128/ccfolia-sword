<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui'
import { formatActionLog } from '@/core/resolver/log-format'
import { useResolverStore } from '@/stores/resolver'

const resolver = useResolverStore()
const resolution = computed(() => resolver.resolution!)
const logText = computed(() => formatActionLog(resolution.value))
const copied = ref(false)

async function copyLog() {
  try {
    await navigator.clipboard.writeText(logText.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1200)
  }
  catch {
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
    <div class="flex items-center justify-between">
      <div class="text-xs text-white/60 font-medium">
        结果预览
      </div>
      <Button size="sm" @click="copyLog()">
        {{ copied ? '已复制' : '复制日志' }}
      </Button>
    </div>

    <div class="grid gap-1 text-xs">
      <div
        v-for="target in resolution.targets"
        :key="target.id"
        class="flex items-center justify-between rounded bg-black/20 px-2 py-1"
      >
        <span class="truncate">{{ target.name || '未命名目标' }}</span>
        <span class="text-hp font-mono">{{ target.finalDamage ?? '—' }}</span>
      </div>
    </div>

    <pre class="overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-xs text-white/80 font-mono">{{ logText }}</pre>
  </div>
</template>
