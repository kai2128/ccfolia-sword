<script setup lang="ts">
import type { BuffFormState } from '@/core/buff/form-helpers'
import type { BuffInstance } from '@/types/buff-v3'
import { ref, watch } from 'vue'
import { updateBuffSnapshot } from '@/ccfolia/writers/update-buff-snapshot'
import BuffForm from '@/components/buffs/BuffForm.vue'
import { Button, Dialog } from '@/components/ui'
import { instanceToForm, normalizeBuffForm } from '@/core/buff/form-helpers'

const props = defineProps<{
  characterId: string
  buff: BuffInstance | null
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const form = ref<BuffFormState>(instanceToForm({
  name: '',
  icon: '',
  description: '',
  modifiers: [],
  polarity: 'positive',
}, undefined))
const busy = ref(false)

watch(
  () => [props.open, props.buff] as const,
  ([open, buff]) => {
    if (open && buff)
      form.value = instanceToForm(buff.snapshot, buff.turnsRemaining)
  },
  { immediate: true },
)

async function save() {
  if (!props.buff || busy.value)
    return
  let n
  try {
    n = normalizeBuffForm(form.value)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert((error as Error).message)
    return
  }
  busy.value = true
  try {
    await updateBuffSnapshot(props.characterId, props.buff.id, n)
    emit('update:open', false)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`保存失败:${(error as Error).message}`)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    title="编辑 Buff"
    @update:open="emit('update:open', $event)"
  >
    <BuffForm v-model="form" />
    <div class="flex justify-end gap-2 pt-1">
      <Button size="sm" variant="ghost" @click="emit('update:open', false)">
        取消
      </Button>
      <Button size="sm" :disabled="busy" @click="save">
        保存
      </Button>
    </div>
  </Dialog>
</template>
