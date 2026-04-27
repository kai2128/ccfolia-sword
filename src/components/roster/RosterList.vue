<script setup lang="ts">
import type { CharacterPartView } from '@/core/character/parts'
import type { StatusSlot } from '@/core/status-slot'
import { computed, reactive, ref } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import AttachBuffDialog from '@/components/buffs/AttachBuffDialog.vue'
import RosterFilterBar from '@/components/roster/RosterFilterBar.vue'
import RosterPartRow from '@/components/roster/RosterPartRow.vue'
import RosterRow from '@/components/roster/RosterRow.vue'
import RosterSectionHeader from '@/components/roster/RosterSectionHeader.vue'
import { useOnCanvasIds } from '@/composables/useOnCanvasIds'
import { usePartsByCharId } from '@/composables/usePartsByCharId'
import { formatActorRef } from '@/core/encounter/actor-ref'
import { groupRoster } from '@/core/roster/group'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const chars = useRoomCharactersStore()
const lib = useTagLibraryStore()
const view = useRosterViewStore()
const settings = useSettingsStore()
const expandedIds = reactive(new Set<string>())
const attachingId = ref<string | null>(null)

const onCanvasIds = useOnCanvasIds()
const partsByCharId = usePartsByCharId()

const groups = computed(() =>
  groupRoster({
    chars: chars.all,
    isOnCanvas: charId => onCanvasIds.value.has(charId),
    byTagId: lib.byId,
    onCanvasOnly: view.onCanvasOnly,
  }),
)

function toggleExpand(id: string) {
  if (expandedIds.has(id))
    expandedIds.delete(id)
  else
    expandedIds.add(id)
}

async function onChange(charId: string, slot: StatusSlot, newValue: number, partKey: string) {
  const char = chars.byId(charId)
  if (!char)
    return
  try {
    await writeStatusValue({ char, slot, newValue, labelMap: settings.statusLabelMap, partPrefix: partKey })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
}

// 多部位 → 主行不渲染 HP/MP(子行各自显示);单部位 → 主行用唯一那条 partView
function mainRowPartView(charId: string): CharacterPartView | null {
  const parts = partsByCharId.value.get(charId) ?? []
  if (parts.length > 1)
    return null
  return parts[0] ?? null
}

function partRowsFor(charId: string): CharacterPartView[] {
  const parts = partsByCharId.value.get(charId) ?? []
  return parts.length > 1 ? parts : []
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
        <ul class="m-0 list-none p-0">
          <template v-for="char in group.chars" :key="char._id">
            <RosterRow
              :char="char"
              :label-map="settings.statusLabelMap"
              :expanded="expandedIds.has(char._id)"
              :part-view="mainRowPartView(char._id)"
              @change="(slot, v, partKey) => onChange(char._id, slot, v, partKey)"
              @toggle-expand="toggleExpand(char._id)"
              @attach-buff="attachingId = char._id"
            />
            <RosterPartRow
              v-for="part in partRowsFor(char._id)"
              :key="formatActorRef(char._id, part.partKey)"
              :char="char"
              :part="part"
              @change="(slot, v, partKey) => onChange(char._id, slot, v, partKey)"
            />
          </template>
        </ul>
      </section>
    </template>

    <AttachBuffDialog
      :open="attachingId !== null"
      :character-id="attachingId ?? ''"
      @update:open="value => {
        if (!value)
          attachingId = null
      }"
    />
  </div>
</template>
