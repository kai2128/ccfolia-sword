<script setup lang="ts">
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed, reactive } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { attachTag, detachTag } from '@/ccfolia/writers/write-tags'
import RosterSectionHeader from '@/components/roster/RosterSectionHeader.vue'
import { Checkbox, Dialog, TagChip } from '@/components/ui'
import { pxToCell } from '@/core/range/grid'
import { groupRoster } from '@/core/roster/group'
import { readTagInstances } from '@/core/tag'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const open = defineModel<boolean>('open', { required: true })

const chars = useRoomCharactersStore()
const pieces = usePiecesStore()
const settings = useSettingsStore()
const view = useRosterViewStore()
const lib = useTagLibraryStore()

// 与 RosterList.vue 一致:画布上 = piece 渲染 + 未隐藏 + 坐标在主板格内
const onCanvasIds = computed(() => {
  const grid = settings.grid
  const ids = new Set<string>()
  for (const piece of pieces.list) {
    if (piece.invisible)
      continue
    if (pxToCell({ x: piece.x, y: piece.y }, grid) === null)
      continue
    ids.add(piece.characterId)
  }
  return ids
})

// 与 RosterList 同一套分组,保持视觉与顺序一致
const groups = computed(() => groupRoster({
  chars: chars.all,
  isOnCanvas: id => onCanvasIds.value.has(id),
  byTagId: lib.byId,
  onCanvasOnly: view.onCanvasOnly,
}))

const totalChars = computed(() => groups.value.reduce((n, g) => n + g.chars.length, 0))
const tags = computed(() => lib.all)

function attachedSet(char: CcfoliaCharacter): Set<string> {
  return new Set(readTagInstances(char).map(t => t.definitionId))
}

const busy = reactive(new Set<string>())
function cellKey(charId: string, tagId: string) {
  return `${charId}::${tagId}`
}

async function toggle(char: CcfoliaCharacter, tagId: string, attached: boolean) {
  const key = cellKey(char._id, tagId)
  if (busy.has(key))
    return
  busy.add(key)
  try {
    if (attached)
      await detachTag(char, tagId)
    else
      await attachTag(char, tagId)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`操作失败:${(e as Error).message}`)
  }
  finally {
    busy.delete(key)
  }
}
</script>

<template>
  <Dialog v-model:open="open" wide title="批量挂 tag">
    <template v-if="totalChars === 0">
      <p class="py-4 text-center text-xs text-white/50">
        当前过滤下没有角色
      </p>
    </template>
    <template v-else-if="tags.length === 0">
      <p class="py-4 text-center text-xs text-white/50">
        Tag 库为空,先去设置里建几个 tag
      </p>
    </template>
    <template v-else>
      <div class="max-h-[65vh] overflow-auto">
        <table class="border-collapse text-xs">
          <thead>
            <tr>
              <th class="sticky left-0 top-0 z-2 border-b border-white/10 bg-surface px-2 py-1 text-left text-white/70 font-medium">
                角色
              </th>
              <th
                v-for="tag in tags"
                :key="tag.id"
                class="sticky top-0 z-1 whitespace-nowrap border-b border-white/10 bg-surface px-1.5 py-1 text-center font-medium"
              >
                <TagChip :tag="tag" size="xs" />
              </th>
            </tr>
          </thead>
          <tbody
            v-for="group in groups"
            :key="`${group.location}-${group.primaryTagId ?? 'none'}`"
          >
            <tr>
              <td
                :colspan="tags.length + 1"
                class="sticky left-0 bg-surface pt-1.5"
              >
                <RosterSectionHeader
                  :location="group.location"
                  :primary-tag="group.primaryTag"
                  :count="group.chars.length"
                />
              </td>
            </tr>
            <tr
              v-for="char in group.chars"
              :key="char._id"
              class="hover:bg-white/5"
            >
              <td class="sticky left-0 z-1 max-w-48 truncate border-b border-white/5 bg-surface px-2 py-0.5 text-white/90">
                {{ char.name || '(未命名)' }}
              </td>
              <td
                v-for="tag in tags"
                :key="tag.id"
                class="border-b border-white/5 px-1.5 py-0.5 text-center"
              >
                <Checkbox
                  :model-value="attachedSet(char).has(tag.id)"
                  :disabled="busy.has(cellKey(char._id, tag.id))"
                  @update:model-value="() => toggle(char, tag.id, attachedSet(char).has(tag.id))"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Dialog>
</template>
