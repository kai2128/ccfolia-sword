<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { ref } from 'vue'
import { detachBuff } from '@/ccfolia/writers/detach-buff'
import { setBuffEnabled } from '@/ccfolia/writers/toggle-buff-enabled'
import { Button } from '@/components/ui'
import BuffIcon from './BuffIcon.vue'

const props = defineProps<{
  characterId: string
  buff: BuffInstance
}>()

const busy = ref(false)

async function toggle() {
  if (busy.value)
    return
  busy.value = true
  try {
    await setBuffEnabled(props.characterId, props.buff.id, !props.buff.enabled)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`切换 buff 失败:${(error as Error).message}`)
  }
  finally {
    busy.value = false
  }
}

async function remove() {
  if (busy.value)
    return
  // eslint-disable-next-line no-alert
  if (!window.confirm(`卸载 ${props.buff.snapshot.name}?`))
    return

  busy.value = true
  try {
    await detachBuff(props.characterId, props.buff.id)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`卸载 buff 失败:${(error as Error).message}`)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5 border border-white/10 rounded bg-black/20 px-2 py-1">
    <BuffIcon :icon="buff.snapshot.icon" />
    <span
      class="min-w-0 flex-1 truncate text-sm text-white"
      :class="{ 'line-through opacity-50': !buff.enabled }"
      :title="buff.snapshot.description"
    >
      {{ buff.snapshot.name }}
    </span>
    <span v-if="buff.turnsRemaining !== undefined" class="shrink-0 text-xs text-white/60">
      {{ buff.turnsRemaining }}T
    </span>
    <span
      v-if="buff.attachedTo.kind === 'aoe'"
      class="shrink-0 rounded bg-white/10 px-1 text-[10px] text-white/70"
    >
      AoE r={{ buff.attachedTo.radius }}
    </span>
    <Button size="xs" variant="ghost" :disabled="busy" :title="buff.enabled ? '禁用' : '启用'" @click="toggle">
      <span class="i-lucide-power text-3.5" />
    </Button>
    <Button size="xs" variant="ghost" :disabled="busy" title="卸载" @click="remove">
      <span class="i-lucide-x text-3.5" />
    </Button>
  </div>
</template>
