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
import { formatActorRef, parseActorRef } from '@/core/encounter/actor-ref'
import { groupRoster } from '@/core/roster/group'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const chars = useRoomCharactersStore()
const lib = useTagLibraryStore()
const view = useRosterViewStore()
const settings = useSettingsStore()
// expandedRefs / attachingRef 都用 actorRef(charId::partKey)做键 —— 多部位每个 part 独立展开/挂 buff
const expandedRefs = reactive(new Set<string>())
const attachingRef = ref<string | null>(null)
const attachingParsed = computed(() => attachingRef.value ? parseActorRef(attachingRef.value) : null)

const onCanvasIds = useOnCanvasIds()
const partsByCharId = usePartsByCharId()

const groups = computed(() =>
  groupRoster({
    chars: chars.all,
    isOnCanvas: charId => onCanvasIds.value.has(charId),
    byTagId: lib.byId,
    onCanvasOnly: view.onCanvasOnly,
    nameQuery: view.nameQuery,
  }),
)

function toggleExpand(ref: string) {
  if (expandedRefs.has(ref))
    expandedRefs.delete(ref)
  else
    expandedRefs.add(ref)
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
              :expanded="expandedRefs.has(formatActorRef(char._id, ''))"
              :part-view="mainRowPartView(char._id)"
              @change="(slot, v, partKey) => onChange(char._id, slot, v, partKey)"
              @toggle-expand="toggleExpand(formatActorRef(char._id, ''))"
              @attach-buff="attachingRef = formatActorRef(char._id, '')"
            />
            <RosterPartRow
              v-for="part in partRowsFor(char._id)"
              :key="formatActorRef(char._id, part.partKey)"
              :char="char"
              :part="part"
              :expanded="expandedRefs.has(formatActorRef(char._id, part.partKey))"
              @change="(slot, v, partKey) => onChange(char._id, slot, v, partKey)"
              @toggle-expand="toggleExpand(formatActorRef(char._id, part.partKey))"
              @attach-buff="attachingRef = formatActorRef(char._id, part.partKey)"
            />
          </template>
        </ul>
      </section>
    </template>

    <AttachBuffDialog
      :open="attachingParsed !== null"
      :character-id="attachingParsed?.charId ?? ''"
      :part-key="attachingParsed?.partKey"
      @update:open="value => {
        if (!value)
          attachingRef = null
      }"
    />
  </div>
</template>
