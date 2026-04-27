<script setup lang="ts">
import type { BuffFormState, NormalizedBuffForm } from '@/core/buff/form-helpers'
import type { AttachTarget, BuffInstance, StatusEffectDefinition } from '@/types/buff-v3'
import { computed, reactive, ref, watchEffect } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import BuffForm from '@/components/buffs/BuffForm.vue'
import { Field, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { computeCoverage } from '@/core/buff/aoe'
import { buildDefinition, deriveLifecycle, EMPTY_BUFF_FORM, normalizeBuffForm } from '@/core/buff/form-helpers'
import { createSnapshot } from '@/core/buff/snapshot'
import { uuid } from '@/infra/uuid'
import { useSettingsStore } from '@/stores/settings'
import { useStatusLibraryStore } from '@/stores/status-library'

// Buff 选/造面板:从库选 + 现场新建两 tab。
// 抽离自 AttachBuffDialog,让批量场景能共用同一份 UI 与 form 逻辑。
//
// 单角色场景(forceSingle=false):支持 AoE,radius 可调,coverage 预览跑 computeCoverage。
// 批量场景(forceSingle=true):隐藏 AoE / 预览 —— 批量已显式选目标,AoE 概念冲突。

const props = withDefaults(defineProps<{
  // 批量模式:隐藏 AoE 字段与覆盖预览,buildInstance 总按 single 处理
  forceSingle?: boolean
  // 单体模式下若为 aoe 定义,以谁为中心做 coverage 预览(单角色对话框传 char._id)
  previewCenterId?: string
}>(), {
  forceSingle: false,
  previewCenterId: '',
})

const lib = useStatusLibraryStore()
const pieces = usePiecesStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()

const tab = ref<'library' | 'create'>('library')
const selectedDefId = ref('')
const form = ref<BuffFormState>({ ...EMPTY_BUFF_FORM })
const saveToLibrary = ref(false)
const aoeRadius = ref(2)

// 一次 prepare() 后缓存,batch 多目标各自 buildInstance 时复用同一份 def + snapshot
let preparedDef: StatusEffectDefinition | null = null
let preparedNormalized: NormalizedBuffForm | null = null
let preparedSource: 'library' | 'create' | null = null

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

const valid = computed(() => {
  if (tab.value === 'library')
    return !!selectedDefinition.value
  // create:简单看名字与描述非空,真正验证留给 prepare()
  return form.value.name.trim() !== '' && form.value.description.trim() !== ''
})

const scope = computed<'single' | 'aoe'>(() => {
  if (props.forceSingle)
    return 'single'
  if (tab.value === 'library')
    return selectedDefinition.value?.scope === 'aoe' ? 'aoe' : 'single'
  return form.value.scope
})

// 选中 AoE 定义时,把 radius 同步为 defaultAoeRadius 或 2
function syncAoeRadiusToSelection() {
  if (props.forceSingle)
    return
  const def = selectedDefinition.value
  if (def?.scope === 'aoe')
    aoeRadius.value = def.defaultAoeRadius ?? 2
}

function onLibrarySelect(id: string | undefined) {
  selectedDefId.value = id ?? ''
  syncAoeRadiusToSelection()
}

const showAoeRadius = computed(() =>
  !props.forceSingle && tab.value === 'library' && selectedDefinition.value?.scope === 'aoe',
)

const coveragePreview = computed<string[]>(() => {
  if (props.forceSingle || !props.previewCenterId)
    return []
  const def = selectedDefinition.value
  if (!def || def.scope !== 'aoe' || tab.value !== 'library')
    return []
  const fake: BuffInstance = {
    id: 'preview',
    definitionId: def.id,
    snapshot: createSnapshot(def),
    attachedTo: { kind: 'aoe', centerCharacterId: props.previewCenterId, radius: aoeRadius.value },
    lifecycle: 'encounter',
    enabled: true,
    attachedAtTurn: 0,
  }
  return Array.from(computeCoverage(fake, pieces.list, settings.grid))
})

function charNameOf(id: string): string {
  return chars.byId(id)?.name ?? '(未知)'
}

interface PrepareOk { ok: true }
interface PrepareErr { ok: false, error: string }

function prepare(): PrepareOk | PrepareErr {
  if (tab.value === 'library') {
    const def = selectedDefinition.value
    if (!def)
      return { ok: false, error: '请选择 Buff' }
    preparedSource = 'library'
    preparedDef = def
    preparedNormalized = null
    return { ok: true }
  }

  try {
    const n = normalizeBuffForm(form.value)
    const defId = saveToLibrary.value ? `custom.${uuid()}` : `ephemeral.${uuid()}`
    const def = buildDefinition(defId, n)
    preparedSource = 'create'
    preparedDef = def
    preparedNormalized = n
    return { ok: true }
  }
  catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function buildInstance(target: AttachTarget, turn: number): BuffInstance {
  if (!preparedDef)
    throw new Error('prepare() 未先调用')

  const def = preparedDef
  const lifecycle = preparedSource === 'library'
    ? (def.defaultDuration !== undefined ? 'encounter' : 'persistent')
    : deriveLifecycle(preparedNormalized?.turnsRemaining)
  const turnsRemaining = preparedSource === 'library'
    ? def.defaultDuration ?? undefined
    : preparedNormalized?.turnsRemaining

  return {
    id: uuid(),
    definitionId: def.id,
    snapshot: createSnapshot(def),
    attachedTo: target,
    lifecycle,
    enabled: true,
    turnsRemaining,
    attachedAtTurn: turn,
  }
}

function commitSaveToLibrary() {
  if (preparedSource !== 'create' || !saveToLibrary.value || !preparedDef)
    return
  lib.upsertCustom(preparedDef)
}

function reset() {
  tab.value = 'library'
  selectedDefId.value = ''
  form.value = { ...EMPTY_BUFF_FORM }
  saveToLibrary.value = false
  aoeRadius.value = 2
  preparedDef = null
  preparedNormalized = null
  preparedSource = null
}

// 把响应式状态收进一个 reactive 对象,parent 通过 picker.state.xxx 拿到自动解包后的值,
// 不踩 defineExpose 对单 ref 解包行为的边界(也免 TS InstanceType 推断 ref 类型噪声)。
const state = reactive({
  valid: false,
  scope: 'single' as 'single' | 'aoe',
  aoeRadius: 2,
})

watchEffect(() => {
  state.valid = valid.value
  state.scope = scope.value
  state.aoeRadius = aoeRadius.value
})

defineExpose({
  state,
  prepare,
  buildInstance,
  commitSaveToLibrary,
  reset,
})
</script>

<template>
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
        <Select
          :model-value="selectedDefId"
          :options="definitionOptions"
          placeholder="请选择 Buff"
          @update:model-value="onLibrarySelect"
        />
      </Field>

      <template v-if="showAoeRadius">
        <Field label="半径" hint="Chebyshev 格,= 米">
          <Input v-model.number="aoeRadius" type="number" min="1" class="w-20" />
        </Field>
        <div class="border border-white/10 rounded bg-black/20 px-2 py-1.5 text-xs text-white/70">
          <div class="mb-1 text-white/80">
            预览覆盖({{ coveragePreview.length }} 人)
          </div>
          <ul v-if="coveragePreview.length" class="list-disc pl-3">
            <li v-for="cid in coveragePreview" :key="cid">
              {{ charNameOf(cid) }}
            </li>
          </ul>
          <div v-else class="text-white/40">
            无覆盖
          </div>
        </div>
      </template>

      <div
        v-if="selectedDefinition"
        class="border border-white/10 rounded bg-black/20 px-2 py-1.5 text-xs text-white/70"
      >
        {{ selectedDefinition.description }}
      </div>
    </TabsContent>

    <TabsContent value="create" class="flex flex-col gap-3 pt-3">
      <BuffForm
        v-model="form"
        v-model:save-to-library="saveToLibrary"
        :show-save-to-library="true"
        :show-scope="!forceSingle"
      />
    </TabsContent>
  </Tabs>
</template>
