<script setup lang="ts">
import type { TagDefinition } from '@/types/tag'
import { ref, watch } from 'vue'
import { Button, Dialog, Field, Input, Label, Switch } from '@/components/ui'
import { useTagLibraryStore } from '@/stores/tag-library'
import { isBuiltinTagId } from '@/types/tag'

const props = defineProps<{
  tag: TagDefinition | null
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'closed'): void
}>()

const lib = useTagLibraryStore()
const form = ref({
  label: '',
  color: '#4b6ef7',
  icon: '',
  order: 10,
  autoKnockdownOnHpZero: false,
})

function resetFormFromProps() {
  if (props.tag) {
    form.value = {
      label: props.tag.label,
      color: props.tag.color,
      icon: props.tag.icon ?? '',
      order: props.tag.order,
      autoKnockdownOnHpZero: props.tag.autoKnockdownOnHpZero === true,
    }
    return
  }

  form.value = {
    label: '',
    color: '#4b6ef7',
    icon: '',
    order: 10,
    autoKnockdownOnHpZero: false,
  }
}

watch(
  [() => props.tag, () => props.open],
  ([, open]) => {
    if (open)
      resetFormFromProps()
  },
  { immediate: true },
)

function closeDialog() {
  emit('update:open', false)
  emit('closed')
}

function save() {
  const patch = {
    label: form.value.label.trim() || '未命名',
    color: form.value.color,
    icon: form.value.icon.trim() || undefined,
    order: Number.isFinite(Number(form.value.order)) ? Number(form.value.order) : 10,
    autoKnockdownOnHpZero: form.value.autoKnockdownOnHpZero,
  }

  if (props.tag) {
    if (isBuiltinTagId(props.tag.id))
      lib.overrideBuiltin(props.tag.id, patch)
    else
      lib.updateCustom(props.tag.id, patch)
  }
  else {
    lib.createCustom(patch)
  }

  closeDialog()
}

function resetBuiltin() {
  if (!props.tag || !isBuiltinTagId(props.tag.id))
    return
  lib.resetBuiltin(props.tag.id)
  closeDialog()
}
</script>

<template>
  <Dialog
    :open="open"
    :title="tag ? '编辑 Tag' : '新建 Tag'"
    @update:open="emit('update:open', $event)"
  >
    <div class="flex flex-col gap-3">
      <Field>
        <Label>名字</Label>
        <Input v-model="form.label" placeholder="Tag 名字" />
      </Field>

      <Field>
        <Label>颜色</Label>
        <div class="flex items-center gap-2">
          <input
            v-model="form.color"
            type="color"
            class="h-8 w-10 border border-white/20 rounded bg-transparent"
          >
          <Input v-model="form.color" class="flex-1" />
        </div>
      </Field>

      <Field>
        <Label>图标（UnoCSS class，选填）</Label>
        <Input v-model="form.icon" placeholder="i-lucide-shield" />
      </Field>

      <Field>
        <Label>Order（越小越优先作为主色）</Label>
        <Input v-model.number="form.order" type="number" />
      </Field>

      <div class="flex flex-col gap-2 border border-white/10 rounded bg-black/20 p-2">
        <label class="flex items-center gap-2 text-xs text-white/80">
          <Switch
            :model-value="form.autoKnockdownOnHpZero"
            @update:model-value="form.autoKnockdownOnHpZero = $event ?? false"
          />
          HP 归零自动倒地（旋转 90°）
        </label>
        <p class="text-[11px] text-white/60 leading-relaxed">
          带本 tag 的角色 HP 跌到 0 时旋转 token (90°)，复活时转回正立 (0°)。
        </p>
      </div>

      <div class="flex items-center justify-between gap-2 pt-2">
        <Button
          v-if="tag && isBuiltinTagId(tag.id)"
          variant="ghost"
          size="sm"
          @click="resetBuiltin"
        >
          恢复默认
        </Button>
        <span v-else />

        <div class="flex gap-2">
          <Button variant="ghost" size="sm" @click="closeDialog">
            取消
          </Button>
          <Button size="sm" @click="save">
            保存
          </Button>
        </div>
      </div>
    </div>
  </Dialog>
</template>
