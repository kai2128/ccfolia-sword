<script setup lang="ts">
import type { BuffInstance, BuffLifecycle, ModifierDefinition, ModifierTarget, StatusEffectDefinition } from '@/types/buff-v3'
import { computed, ref, watch } from 'vue'
import { attachBuff } from '@/ccfolia/writers/attach-buff'
import { Button, Dialog, Field, Input, Select } from '@/components/ui'
import { toFiniteOrUndef } from '@/core/buff/coerce'
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

const selectedDefId = ref('')
const turnsRemaining = ref<number | ''>('')
const lifecycle = ref<BuffLifecycle>('persistent')
const note = ref('')
const modifiers = ref<ModifierDefinition[]>([])
const busy = ref(false)

const modifierTargetOptions: Array<{ value: ModifierTarget, label: string }> = [
  { value: 'defense', label: '防御' },
  { value: 'attack', label: '攻击' },
  { value: 'damage', label: '伤害' },
  { value: 'resist-mental', label: '精神抵抗' },
  { value: 'resist-life', label: '生命抵抗' },
]

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

const canConfirm = computed(() =>
  !!selectedDefinition.value && selectedDefinition.value.scope === 'single' && !busy.value,
)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      selectedDefId.value = ''
      turnsRemaining.value = ''
      lifecycle.value = 'persistent'
      note.value = ''
      modifiers.value = []
    }
  },
)

watch(selectedDefinition, (definition) => {
  if (!definition) {
    turnsRemaining.value = ''
    lifecycle.value = 'persistent'
    modifiers.value = []
    return
  }
  turnsRemaining.value = definition.defaultDuration ?? ''
  lifecycle.value = definition.defaultDuration !== undefined ? 'encounter' : 'persistent'
  modifiers.value = definition.modifiers.map(modifier => ({ ...modifier }))
})

function addModifier() {
  modifiers.value.push({ target: 'defense', value: 0 })
}

function closeDialog() {
  emit('update:open', false)
}

async function confirm() {
  const definition = selectedDefinition.value
  if (!definition || definition.scope !== 'single' || busy.value)
    return

  const snapshot = createSnapshot(definition)
  snapshot.modifiers = modifiers.value.map(modifier => ({ ...modifier }))

  const buff: BuffInstance = {
    id: uuid(),
    definitionId: definition.id,
    snapshot,
    attachedTo: { kind: 'single', characterId: props.characterId },
    lifecycle: lifecycle.value,
    enabled: true,
    turnsRemaining: toFiniteOrUndef(turnsRemaining.value),
    attachedAtTurn: encounter.shared.turn,
    note: note.value.trim() || undefined,
  }

  busy.value = true
  try {
    await attachBuff(props.characterId, buff)
    closeDialog()
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
    description="本计划只支持单体 Buff；AoE 定义可浏览，但暂时不能挂载。"
    @update:open="emit('update:open', $event)"
  >
    <div class="flex flex-col gap-3">
      <Field label="效果">
        <Select v-model="selectedDefId" :options="definitionOptions" placeholder="请选择 Buff" />
      </Field>

      <div
        v-if="selectedDefinition?.scope === 'aoe'"
        class="border border-debuff/40 rounded bg-debuff/10 px-2 py-1.5 text-xs text-debuff"
      >
        AoE 挂载将在 Plan 06 接入，这里暂时禁用。
      </div>

      <template v-if="selectedDefinition">
        <div class="border border-white/10 rounded bg-black/20 px-2 py-1.5 text-xs text-white/70">
          {{ selectedDefinition.description }}
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Field label="剩余回合" hint="留空表示手动移除">
            <Input v-model.number="turnsRemaining" type="number" min="0" />
          </Field>
          <Field label="生命周期">
            <Select
              v-model="lifecycle"
              :options="[
                { value: 'encounter', label: '本场战斗' },
                { value: 'persistent', label: '跨战斗' },
              ]"
            />
          </Field>
        </div>

        <Field label="Modifiers" hint="挂载时可调整；挂上后以 snapshot 冻结">
          <div class="flex flex-col gap-2">
            <div
              v-for="(modifier, index) in modifiers"
              :key="`${modifier.target}-${index}`"
              class="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-2"
            >
              <Select v-model="modifier.target" :options="modifierTargetOptions" />
              <Input v-model.number="modifier.value" type="number" />
              <Button size="xs" variant="ghost" @click="modifiers.splice(index, 1)">
                <span class="i-lucide-x text-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" @click="addModifier">
              <span class="i-lucide-plus text-3.5" />
              加 modifier
            </Button>
          </div>
        </Field>

        <Field label="备注">
          <Input v-model="note" placeholder="可选" />
        </Field>
      </template>

      <div class="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" @click="closeDialog">
          取消
        </Button>
        <Button size="sm" :disabled="!canConfirm" @click="confirm">
          挂载
        </Button>
      </div>
    </div>
  </Dialog>
</template>
