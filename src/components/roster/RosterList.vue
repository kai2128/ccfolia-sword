<script setup lang="ts">
import type { StatusSlot } from '@/core/status-slot'
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import RosterFilterBar from '@/components/roster/RosterFilterBar.vue'
import RosterRow from '@/components/roster/RosterRow.vue'
import RosterSectionHeader from '@/components/roster/RosterSectionHeader.vue'
import { groupRoster } from '@/core/roster/group'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const chars = useRoomCharactersStore()
const pieces = usePiecesStore()
const lib = useTagLibraryStore()
const view = useRosterViewStore()
const settings = useSettingsStore()

const onCanvasIds = computed(() => {
  const ids = new Set<string>()
  for (const piece of pieces.list) {
    if (!piece.invisible)
      ids.add(piece.characterId)
  }
  return ids
})

const groups = computed(() =>
  groupRoster({
    chars: chars.all,
    isOnCanvas: charId => onCanvasIds.value.has(charId),
    byTagId: lib.byId,
    onCanvasOnly: view.onCanvasOnly,
  }),
)

async function onChange(charId: string, slot: StatusSlot, newValue: number) {
  const char = chars.byId(charId)
  if (!char)
    return
  try {
    await writeStatusValue({ char, slot, newValue, labelMap: settings.statusLabelMap })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
}
</script>

<template>
  <div class="flex flex-col">
    <RosterFilterBar />

    <template v-if="chars.all.length === 0">
      <p class="py-2 text-xs text-white/50">
        房间内没有角色
      </p>
    </template>
    <template v-else-if="groups.length === 0">
      <p class="py-2 text-xs text-white/50">
        当前过滤下没有匹配的角色
      </p>
    </template>
    <template v-else>
      <section v-for="group in groups" :key="`${group.location}-${group.primaryTagId ?? 'none'}`">
        <RosterSectionHeader
          :location="group.location"
          :primary-tag="group.primaryTag"
          :count="group.chars.length"
        />
        <ul class="list-none p-0">
          <RosterRow
            v-for="char in group.chars"
            :key="char._id"
            :char="char"
            :label-map="settings.statusLabelMap"
            @change="(slot, v) => onChange(char._id, slot, v)"
          />
        </ul>
      </section>
    </template>
  </div>
</template>
