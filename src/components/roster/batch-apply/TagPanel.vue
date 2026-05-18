<script setup lang="ts">
import type { BatchProgress } from './types'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { reactive } from 'vue'
import { attachTag, detachTag } from '@/ccfolia/writers/write-tags'
import { Button, TagChip } from '@/components/ui'
import { readTagInstances } from '@/core/tag'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  uniqueSelectedChars: CcfoliaCharacter[]
}>()

const lib = useTagLibraryStore()

function charHasTag(char: CcfoliaCharacter, tagId: string): boolean {
  return readTagInstances(char).some(t => t.definitionId === tagId)
}
function tagCoverage(tagId: string): { hit: number, total: number } {
  let hit = 0
  for (const c of props.uniqueSelectedChars) {
    if (charHasTag(c, tagId))
      hit++
  }
  return { hit, total: props.uniqueSelectedChars.length }
}
// 每个 tagId 一份进度;按钮模板用 tagProgress.get(tagId) 取。
const tagProgress = reactive(new Map<string, BatchProgress>())
async function runTagOp(tagId: string, predicate: (c: CcfoliaCharacter) => boolean, write: (c: CcfoliaCharacter) => Promise<void>, errLabel: string) {
  if (tagProgress.has(tagId))
    return
  const targets = props.uniqueSelectedChars.filter(predicate)
  if (targets.length === 0)
    return
  const total = targets.length
  let done = 0
  tagProgress.set(tagId, { done: 0, total })
  try {
    await Promise.all(targets.map(c => write(c).finally(() => {
      done++
      tagProgress.set(tagId, { done, total })
    })))
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`${errLabel}:${(e as Error).message}`)
  }
  finally {
    tagProgress.delete(tagId)
  }
}
function batchAttachTag(tagId: string) {
  return runTagOp(tagId, c => !charHasTag(c, tagId), c => attachTag(c, tagId), '挂 tag 失败')
}
function batchDetachTag(tagId: string) {
  return runTagOp(tagId, c => charHasTag(c, tagId), c => detachTag(c, tagId), '卸 tag 失败')
}
</script>

<template>
  <div class="flex flex-col gap-2 pt-3">
    <p class="text-xs text-white/60">
      Tag 挂在角色级,多部位角色去重后操作。每个 tag 显示当前选中里的覆盖度。
    </p>
    <div v-if="uniqueSelectedChars.length === 0" class="py-2 text-center text-xs text-white/40">
      未选中角色
    </div>
    <div v-else-if="lib.all.length === 0" class="py-2 text-center text-xs text-white/40">
      Tag 库为空,先去设置里建几个 tag
    </div>
    <div v-else class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 gap-y-1">
      <template v-for="tag in lib.all" :key="tag.id">
        <TagChip :tag="tag" size="sm" />
        <span class="text-[11px] text-white/50 tabular-nums">
          {{ tagCoverage(tag.id).hit }} / {{ tagCoverage(tag.id).total }}
        </span>
        <Button
          size="xs"
          variant="ghost"
          :loading="tagProgress.has(tag.id)"
          :disabled="tagCoverage(tag.id).hit >= tagCoverage(tag.id).total"
          @click="batchAttachTag(tag.id)"
        >
          {{ tagProgress.get(tag.id) ? `添加中 ${tagProgress.get(tag.id)!.done}/${tagProgress.get(tag.id)!.total}` : '+ 全部添加' }}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          :loading="tagProgress.has(tag.id)"
          :disabled="tagCoverage(tag.id).hit === 0"
          @click="batchDetachTag(tag.id)"
        >
          {{ tagProgress.get(tag.id) ? `移除中 ${tagProgress.get(tag.id)!.done}/${tagProgress.get(tag.id)!.total}` : '− 全部移除' }}
        </Button>
      </template>
    </div>
  </div>
</template>
