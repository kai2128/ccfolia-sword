<script setup lang="ts">
import type { TagDefinition } from '@/types/tag'
import { ref } from 'vue'
import TagEditDialog from '@/components/tags/TagEditDialog.vue'
import { Button, TagChip } from '@/components/ui'
import { useTagLibraryStore } from '@/stores/tag-library'
import { isBuiltinTagId } from '@/types/tag'

const lib = useTagLibraryStore()
const editing = ref<TagDefinition | null>(null)
const dialogOpen = ref(false)

function edit(tag: TagDefinition) {
  editing.value = tag
  dialogOpen.value = true
}

function create() {
  editing.value = null
  dialogOpen.value = true
}

function remove(tag: TagDefinition) {
  if (isBuiltinTagId(tag.id))
    return

  // eslint-disable-next-line no-alert
  if (!window.confirm(`删除 tag「${tag.label}」? 已挂在角色身上的条目会保留在 params 中,但不会再显示。`))
    return

  lib.removeCustom(tag.id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <h4 class="text-sm text-white">
        Tag 库
      </h4>
      <Button size="sm" @click="create">
        <span class="i-lucide-plus text-3" />
        新建
      </Button>
    </div>

    <ul class="flex flex-col list-none gap-1 p-0">
      <li
        v-for="tag in lib.all"
        :key="tag.id"
        class="flex items-center gap-2 border border-white/10 rounded bg-black/20 px-2 py-1.5"
      >
        <TagChip :tag="tag" size="sm" />
        <span class="flex-1 text-[11px] text-white/50">
          {{ isBuiltinTagId(tag.id) ? 'builtin' : 'custom' }} · order {{ tag.order }}
        </span>
        <Button size="sm" variant="ghost" @click="edit(tag)">
          编辑
        </Button>
        <Button
          v-if="!isBuiltinTagId(tag.id)"
          size="sm"
          variant="danger"
          @click="remove(tag)"
        >
          删除
        </Button>
      </li>
    </ul>

    <TagEditDialog v-model:open="dialogOpen" :tag="editing" />
  </div>
</template>
