<script setup lang="ts">
import type { BuffFormState } from '@/core/buff/form-helpers'
import type { BuffInstance, StatusEffectDefinition } from '@/types/buff-v3'
import { computed, ref, watch } from 'vue'
import { attachBuff } from '@/ccfolia/writers/attach-buff'
import BuffForm from '@/components/buffs/BuffForm.vue'
import { Button, Dialog, Field, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {

  buildDefinition,
  deriveLifecycle,
  EMPTY_BUFF_FORM,
  normalizeBuffForm,
} from '@/core/buff/form-helpers'
import { createSnapshot } from '@/core/buff/snapshot'
import { uuid } from '@/infra/uuid'
import { useEncounterStore } from '@/stores/encounter'
import { useStatusLibraryStore } from '@/stores/status-library'

const props = defineProps<{
  characterId: string
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const lib = useStatusLibraryStore()
const encounter = useEncounterStore()

const tab = ref<'library' | 'create'>('library')
const selectedDefId = ref('')
const form = ref<BuffFormState>({ ...EMPTY_BUFF_FORM })
const saveToLibrary = ref(false)
const busy = ref(false)

const definitionOptions = computed(() => [
  { value: '', label: '请选择 Buff' },
  ...lib.all.map(definition => ({
    value: definition.id,
    label: `${definition.name} · ${definition.scope === 'aoe' ? 'AoE' : '单体'}`,
  })),
])

const selectedDefinition = computed<StatusEffectDefinition | null>(() => {
  if (!selectedDefId.value)
    return null
  return lib.byId(selectedDefId.value) ?? null
})

const aoeBlocked = computed(() => selectedDefinition.value?.scope === 'aoe')

const canConfirmLibrary = computed(() =>
  !!selectedDefinition.value && selectedDefinition.value.scope === 'single' && !busy.value,
)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      tab.value = 'library'
      selectedDefId.value = ''
      form.value = { ...EMPTY_BUFF_FORM }
      saveToLibrary.value = false
    }
  },
)

function close() {
  emit('update:open', false)
}

async function confirmFromLibrary() {
  const def = selectedDefinition.value
  if (!def || def.scope !== 'single' || busy.value)
    return

  const buff: BuffInstance = {
    id: uuid(),
    definitionId: def.id,
    snapshot: createSnapshot(def),
    attachedTo: { kind: 'single', characterId: props.characterId },
    lifecycle: def.defaultDuration !== undefined ? 'encounter' : 'persistent',
    enabled: true,
    turnsRemaining: def.defaultDuration ?? undefined,
    attachedAtTurn: encounter.shared.turn,
  }

  busy.value = true
  try {
    await attachBuff(props.characterId, buff)
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

async function confirmCreate() {
  if (busy.value)
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

  const instanceId = uuid()
  const defId = saveToLibrary.value ? `custom.${uuid()}` : `ephemeral.${uuid()}`
  const def = buildDefinition(defId, n)

  const buff: BuffInstance = {
    id: instanceId,
    definitionId: defId,
    snapshot: createSnapshot(def),
    attachedTo: { kind: 'single', characterId: props.characterId },
    lifecycle: deriveLifecycle(n.turnsRemaining),
    enabled: true,
    turnsRemaining: n.turnsRemaining,
    attachedAtTurn: encounter.shared.turn,
  }

  busy.value = true
  try {
    await attachBuff(props.characterId, buff)
    if (saveToLibrary.value)
      lib.upsertCustom(def)
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
    <Tabs v-model="tab">
      <TabsList class="h-8 flex border-b border-white/10">
        <TabsTrigger
          value="library"
          class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
        >
          从库选择
        </TabsTrigger>
        <TabsTrigger
          value="create"
          class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
        >
          现场新建
        </TabsTrigger>
      </TabsList>

      <TabsContent value="library" class="flex flex-col gap-3 pt-3">
        <Field label="效果">
          <Select v-model="selectedDefId" :options="definitionOptions" placeholder="请选择 Buff" />
        </Field>

        <div
          v-if="aoeBlocked"
          class="border border-debuff/40 rounded bg-debuff/10 px-2 py-1.5 text-xs text-debuff"
        >
          AoE 挂载将在 Plan 06 接入,这里暂时禁用。
        </div>

        <div
          v-if="selectedDefinition"
          class="border border-white/10 rounded bg-black/20 px-2 py-1.5 text-xs text-white/70"
        >
          {{ selectedDefinition.description }}
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" @click="close">
            取消
          </Button>
          <Button size="sm" :disabled="!canConfirmLibrary" @click="confirmFromLibrary">
            挂载
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="create" class="flex flex-col gap-3 pt-3">
        <BuffForm v-model="form" v-model:save-to-library="saveToLibrary" :show-save-to-library="true" />
        <div class="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" @click="close">
            取消
          </Button>
          <Button size="sm" :disabled="busy" @click="confirmCreate">
            挂载
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  </Dialog>
</template>
