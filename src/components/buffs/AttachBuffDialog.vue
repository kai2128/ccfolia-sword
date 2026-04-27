<script setup lang="ts">
import type { AttachTarget } from '@/types/buff-v3'
import { ref, watch } from 'vue'
import { attachBuff } from '@/ccfolia/writers/attach-buff'
import BuffPicker from '@/components/buffs/BuffPicker.vue'
import { Button, Dialog } from '@/components/ui'
import { useEncounterStore } from '@/stores/encounter'

const props = defineProps<{
  characterId: string
  // 多部位:挂到具体 part(如 'XX' / 'X1');省略 / '' = 整体或单部位
  partKey?: string
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const encounter = useEncounterStore()

const picker = ref<InstanceType<typeof BuffPicker> | null>(null)
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open)
      picker.value?.reset()
  },
)

function close() {
  emit('update:open', false)
}

async function confirm() {
  if (busy.value || !picker.value)
    return

  const prep = picker.value.prepare()
  if (!prep.ok) {
    // eslint-disable-next-line no-alert
    alert(prep.error)
    return
  }

  const target: AttachTarget = picker.value.state.scope === 'aoe'
    ? { kind: 'aoe', centerCharacterId: props.characterId, radius: picker.value.state.aoeRadius }
    : { kind: 'single', characterId: props.characterId, partKey: props.partKey || undefined }

  const buff = picker.value.buildInstance(target, encounter.shared.turn)

  busy.value = true
  try {
    await attachBuff(props.characterId, buff)
    picker.value.commitSaveToLibrary()
    close()
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`挂载 buff 失败:${(error as Error).message}`)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    title="挂载 Buff"
    @update:open="emit('update:open', $event)"
  >
    <BuffPicker ref="picker" :preview-center-id="characterId" />
    <div class="flex justify-end gap-2 pt-1">
      <Button size="sm" variant="ghost" @click="close">
        取消
      </Button>
      <Button size="sm" :disabled="!picker?.state.valid || busy" @click="confirm">
        挂载
      </Button>
    </div>
  </Dialog>
</template>
