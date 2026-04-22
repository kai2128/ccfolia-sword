<script setup lang="ts">
import type { ModifierDefinition, ModifierTarget, StatusEffectDefinition } from '@/types/buff-v3'
import { computed, ref } from 'vue'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'
import { toFiniteOrUndef } from '@/core/buff/coerce'
import { uuid } from '@/infra/uuid'
import { useStatusLibraryStore } from '@/stores/status-library'
import BuffIcon from './BuffIcon.vue'

const lib = useStatusLibraryStore()

const editing = ref<StatusEffectDefinition | null>(null)

const scopeOptions = [
  { value: 'single', label: '单体' },
  { value: 'aoe', label: 'AoE' },
]

const modifierTargetOptions: Array<{ value: ModifierTarget, label: string }> = [
  { value: 'defense', label: '防御' },
  { value: 'attack', label: '攻击' },
  { value: 'damage', label: '伤害' },
  { value: 'resist-mental', label: '精神抵抗' },
  { value: 'resist-life', label: '生命抵抗' },
]

const definitions = computed(() => lib.all)

function createDefinition(): StatusEffectDefinition {
  return {
    id: `custom.${uuid()}`,
    name: '',
    icon: 'i-mdi-star',
    description: '',
    scope: 'single',
    modifiers: [],
    builtin: false,
  }
}

function startCreate() {
  editing.value = createDefinition()
}

function cloneDefinition(definition: StatusEffectDefinition): StatusEffectDefinition {
  return {
    ...definition,
    modifiers: definition.modifiers.map(modifier => ({ ...modifier })),
  }
}

function startEdit(definition: StatusEffectDefinition) {
  if (definition.builtin) {
    // eslint-disable-next-line no-alert
    alert('内置 Buff 不可直接编辑，请新建自定义条目。')
    return
  }
  editing.value = cloneDefinition(definition)
}

function remove(definition: StatusEffectDefinition) {
  if (definition.builtin)
    return
  // eslint-disable-next-line no-alert
  if (!window.confirm(`删除 ${definition.name || '未命名 Buff'}? 已挂载实例不会受影响。`))
    return
  lib.removeCustom(definition.id)
  if (editing.value?.id === definition.id)
    editing.value = null
}

function reset() {
  // eslint-disable-next-line no-alert
  if (!window.confirm('清空所有自定义 Buff 定义？'))
    return
  lib.resetCustom()
  editing.value = null
}

function addModifier() {
  editing.value?.modifiers.push({ target: 'defense', value: 0 })
}

function save() {
  if (!editing.value)
    return

  const normalized: StatusEffectDefinition = {
    ...editing.value,
    name: editing.value.name.trim(),
    icon: editing.value.icon.trim() || 'i-mdi-star',
    description: editing.value.description.trim(),
    color: editing.value.color?.trim() || undefined,
    tickPrompt: editing.value.tickPrompt?.trim() || undefined,
    reminder: editing.value.reminder?.trim() || undefined,
    defaultDuration: toFiniteOrUndef(editing.value.defaultDuration),
    defaultAoeRadius: toFiniteOrUndef(editing.value.defaultAoeRadius),
    modifiers: editing.value.modifiers.map((modifier: ModifierDefinition) => ({ ...modifier })),
    builtin: false,
  }

  if (!normalized.name) {
    // eslint-disable-next-line no-alert
    alert('名字不能为空')
    return
  }
  if (!normalized.description) {
    // eslint-disable-next-line no-alert
    alert('描述不能为空')
    return
  }
  if (normalized.scope === 'single')
    normalized.defaultAoeRadius = undefined

  lib.upsertCustom(normalized)
  editing.value = cloneDefinition(normalized)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm text-white">
        Buff 库
      </h4>
      <div class="flex gap-2">
        <Button size="sm" variant="ghost" @click="reset">
          重置自定义
        </Button>
        <Button size="sm" @click="startCreate">
          <span class="i-lucide-plus text-3.5" />
          新建
        </Button>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div class="flex flex-col gap-1">
        <div
          v-for="definition in definitions"
          :key="definition.id"
          class="flex items-center gap-2 border border-white/10 rounded bg-black/20 px-2 py-1.5"
        >
          <BuffIcon :icon="definition.icon" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-white">
              {{ definition.name }}
            </div>
            <div class="flex items-center gap-1 text-[11px] text-white/45">
              <span>{{ definition.scope }}</span>
              <span v-if="definition.builtin" class="rounded bg-white/10 px-1 text-white/70">内置</span>
            </div>
          </div>
          <Button
            v-if="!definition.builtin"
            size="xs"
            variant="ghost"
            @click="startEdit(definition)"
          >
            编辑
          </Button>
          <Button
            v-if="!definition.builtin"
            size="xs"
            variant="ghost"
            @click="remove(definition)"
          >
            删除
          </Button>
        </div>
      </div>

      <div v-if="editing" class="flex flex-col gap-3 border border-white/10 rounded bg-black/20 p-3">
        <div class="text-sm text-white">
          {{ editing.id.startsWith('custom.') && editing.name ? `编辑 ${editing.name}` : '编辑定义' }}
        </div>

        <div class="grid gap-2 md:grid-cols-2">
          <Field label="名字">
            <Input v-model="editing.name" placeholder="灼烧" />
          </Field>
          <Field label="图标">
            <Input v-model="editing.icon" placeholder="i-mdi-fire 或 🔥" />
          </Field>
        </div>

        <div class="grid gap-2 md:grid-cols-2">
          <Field label="颜色">
            <Input v-model="editing.color" placeholder="#ff7a18（可选）" />
          </Field>
          <Field label="作用范围">
            <Select v-model="editing.scope" :options="scopeOptions" />
          </Field>
        </div>

        <Field label="描述">
          <Textarea v-model="editing.description" rows="3" placeholder="描述此 Buff 的效果" />
        </Field>

        <div class="grid gap-2 md:grid-cols-2">
          <Field label="默认持续回合" hint="留空表示手动移除">
            <Input v-model.number="editing.defaultDuration" type="number" min="0" />
          </Field>
          <Field v-if="editing.scope === 'aoe'" label="默认半径">
            <Input v-model.number="editing.defaultAoeRadius" type="number" min="0" />
          </Field>
        </div>

        <div class="grid gap-2 md:grid-cols-2">
          <Field label="Tick 提示">
            <Input v-model="editing.tickPrompt" placeholder="回合推进时提示文案" />
          </Field>
          <Field label="文字提醒">
            <Input v-model="editing.reminder" placeholder="不进入 modifier 的备注" />
          </Field>
        </div>

        <Field label="Modifiers">
          <div class="flex flex-col gap-2">
            <div
              v-for="(modifier, index) in editing.modifiers"
              :key="`${modifier.target}-${index}`"
              class="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-2"
            >
              <Select v-model="modifier.target" :options="modifierTargetOptions" />
              <Input v-model.number="modifier.value" type="number" />
              <Button size="xs" variant="ghost" @click="editing.modifiers.splice(index, 1)">
                <span class="i-lucide-x text-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" @click="addModifier">
              <span class="i-lucide-plus text-3.5" />
              加 modifier
            </Button>
          </div>
        </Field>

        <div class="flex justify-end gap-2">
          <Button size="sm" variant="ghost" @click="editing = null">
            取消
          </Button>
          <Button size="sm" @click="save">
            保存
          </Button>
        </div>
      </div>

      <div v-else class="flex items-center justify-center border border-white/10 rounded border-dashed bg-black/10 p-6 text-sm text-white/40">
        选择一个自定义 Buff 编辑，或新建一条定义。
      </div>
    </div>
  </div>
</template>
