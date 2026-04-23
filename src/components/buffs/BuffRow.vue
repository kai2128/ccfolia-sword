<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed, ref } from 'vue'
import { detachBuff } from '@/ccfolia/writers/detach-buff'
import { setBuffEnabled } from '@/ccfolia/writers/toggle-buff-enabled'
import AoeCoverageEditor from '@/components/buffs/AoeCoverageEditor.vue'
import BuffEditDialog from '@/components/buffs/BuffEditDialog.vue'
import BuffIcon from '@/components/buffs/BuffIcon.vue'
import { Button } from '@/components/ui'

const props = defineProps<{
  characterId: string
  buff: BuffInstance
}>()

const busy = ref(false)
const editing = ref(false)
const coverageEditing = ref(false)
const isPositive = computed(() => props.buff.snapshot.polarity === 'positive')
const isAoe = computed(() => props.buff.attachedTo.kind === 'aoe')

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
  <div
    class="flex items-center gap-1.5 border border-l-4 border-white/10 rounded bg-black/20 px-2 py-1"
    :class="isPositive ? 'border-l-buff' : 'border-l-debuff'"
  >
    <BuffIcon :icon="buff.snapshot.icon" />
    <span
      class="h-1.5 w-1.5 shrink-0 rounded-full"
      :class="isPositive ? 'bg-buff' : 'bg-debuff'"
    />
    <span
      class="min-w-0 flex-1 truncate text-sm text-white"
      :class="{ 'line-through opacity-50': !buff.enabled }"
      :title="buff.snapshot.description"
    >
      {{ buff.snapshot.name }}
    </span>
    <span v-if="buff.snapshot.actionValue !== undefined" class="shrink-0 text-xs text-white/70" title="行使值">
      {{ buff.snapshot.actionValue }}
    </span>
    <span v-if="buff.turnsRemaining !== undefined" class="shrink-0 text-xs text-white/60">
      {{ buff.turnsRemaining }}T
    </span>
    <Button size="xs" variant="ghost" :disabled="busy" :title="buff.enabled ? '禁用' : '启用'" @click="toggle">
      <span class="i-lucide-power text-3.5" />
    </Button>
    <Button v-if="isAoe" size="xs" variant="ghost" :disabled="busy" title="调整覆盖" @click="coverageEditing = true">
      <span class="i-lucide-users text-3.5" />
    </Button>
    <Button size="xs" variant="ghost" :disabled="busy" title="编辑" @click="editing = true">
      <span class="i-lucide-pencil text-3.5" />
    </Button>
    <Button size="xs" variant="ghost" :disabled="busy" title="卸载" @click="remove">
      <span class="i-lucide-x text-3.5" />
    </Button>

    <BuffEditDialog
      :character-id="characterId"
      :buff="buff"
      :open="editing"
      @update:open="editing = $event"
    />
    <AoeCoverageEditor
      v-if="isAoe"
      :buff="buff"
      :center-character-id="characterId"
      :open="coverageEditing"
      @update:open="coverageEditing = $event"
    />
  </div>
</template>
