<script setup lang="ts">
import type { StatusEffectDefinition } from '@/types/buff-v3'
import { computed, ref } from 'vue'
import BuffForm from '@/components/buffs/BuffForm.vue'
import BuffIcon from '@/components/buffs/BuffIcon.vue'
import { Button, Dialog } from '@/components/ui'
import {
  type BuffFormState,
  buildDefinition,
  definitionToForm,
  EMPTY_BUFF_FORM,
  normalizeBuffForm,
} from '@/core/buff/form-helpers'
import { uuid } from '@/infra/uuid'
import { useStatusLibraryStore } from '@/stores/status-library'

const lib = useStatusLibraryStore()
const definitions = computed(() => lib.all)

const editorOpen = ref(false)
const form = ref<BuffFormState>({ ...EMPTY_BUFF_FORM })
const editingId = ref<string | null>(null)

function startCreate() {
  form.value = { ...EMPTY_BUFF_FORM }
  editingId.value = null
  editorOpen.value = true
}

function startEdit(definition: StatusEffectDefinition) {
  form.value = definitionToForm(definition)
  editingId.value = definition.id
  editorOpen.value = true
}

function remove(definition: StatusEffectDefinition) {
  if (definition.builtin)
    return
  // eslint-disable-next-line no-alert
  if (!window.confirm(`删除 ${definition.name || '未命名 Buff'}?已挂载实例不会受影响。`))
    return
  lib.removeCustom(definition.id)
  if (editingId.value === definition.id) {
    editorOpen.value = false
    editingId.value = null
  }
}

function reset() {
  // eslint-disable-next-line no-alert
  if (!window.confirm('清空所有自定义 Buff 定义?'))
    return
  lib.resetCustom()
  editorOpen.value = false
  editingId.value = null
}

function save() {
  let n
  try {
    n = normalizeBuffForm(form.value)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert((error as Error).message)
    return
  }
  const id = editingId.value ?? `custom.${uuid()}`
  const def = buildDefinition(id, n)
  lib.upsertCustom(def)
  editorOpen.value = false
  editingId.value = null
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

    <ul class="m-0 flex flex-col list-none gap-1 p-0">
      <li
        v-for="definition in definitions"
        :key="definition.id"
        class="flex items-center gap-1.5 border border-white/10 rounded border-l-4 bg-black/20 px-2 py-1"
        :class="definition.polarity === 'positive' ? 'border-l-buff' : 'border-l-debuff'"
      >
        <BuffIcon :icon="definition.icon" />
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full"
          :class="definition.polarity === 'positive' ? 'bg-buff' : 'bg-debuff'"
        />
        <span class="min-w-0 flex-1 truncate text-sm text-white">
          {{ definition.name }}
        </span>
        <span class="shrink-0 rounded bg-white/10 px-1 text-[10px] text-white/70">
          {{ definition.builtin ? '内置' : '自定义' }}
        </span>
        <Button
          v-if="!definition.builtin"
          size="xs"
          variant="ghost"
          title="编辑"
          @click="startEdit(definition)"
        >
          <span class="i-lucide-pencil text-3.5" />
        </Button>
        <Button
          v-if="!definition.builtin"
          size="xs"
          variant="ghost"
          title="删除"
          @click="remove(definition)"
        >
          <span class="i-lucide-x text-3.5" />
        </Button>
      </li>
    </ul>

    <Dialog
      :open="editorOpen"
      :title="editingId ? '编辑 Buff' : '新建 Buff'"
      @update:open="editorOpen = $event"
    >
      <BuffForm v-model="form" />
      <div class="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" @click="editorOpen = false">
          取消
        </Button>
        <Button size="sm" @click="save">
          保存
        </Button>
      </div>
    </Dialog>
  </div>
</template>
