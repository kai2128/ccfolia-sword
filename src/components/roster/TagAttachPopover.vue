<script setup lang="ts">
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed, ref } from 'vue'
import { attachTag, detachTag } from '@/ccfolia/writers/write-tags'
import { TagChip } from '@/components/ui'
import { readTagInstances } from '@/core/tag'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  char: CcfoliaCharacter
}>()

const lib = useTagLibraryStore()
const open = ref(false)

const attachedIds = computed(() =>
  new Set(readTagInstances(props.char).map(tag => tag.definitionId)),
)

async function toggle(tagId: string) {
  try {
    if (attachedIds.value.has(tagId))
      await detachTag(props.char, tagId)
    else
      await attachTag(props.char, tagId)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`操作失败：${(error as Error).message}`)
  }
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="h-5 flex items-center border border-white/20 rounded bg-black/30 px-1.5 text-[10px] text-white/70 hover:bg-white/10"
      :title="open ? '关闭' : '挂/卸 tag'"
      @click="open = !open"
    >
      <span class="i-lucide-plus text-3" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-6 z-20 min-w-40 flex flex-col gap-1 border border-white/15 rounded bg-surface p-2 shadow-lg"
    >
      <button
        v-for="tag in lib.all"
        :key="tag.id"
        type="button"
        class="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-white/10"
        @click="toggle(tag.id)"
      >
        <TagChip :tag="tag" size="xs" />
        <span v-if="attachedIds.has(tag.id)" class="i-lucide-check text-3 text-accent" />
      </button>

      <p v-if="lib.all.length === 0" class="text-center text-[11px] text-white/40">
        Tag 库为空
      </p>
    </div>
  </div>
</template>
