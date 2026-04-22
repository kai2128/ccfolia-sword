<script setup lang="ts">
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { primaryTag, readTagInstances, resolveTags } from '@/core/tag'
import { useEncounterStore } from '@/stores/encounter'
import { useTagLibraryStore } from '@/stores/tag-library'

const encounter = useEncounterStore()
const chars = useRoomCharactersStore()
const lib = useTagLibraryStore()

interface ChipItem {
  char: CcfoliaCharacter
  acted: boolean
  current: boolean
  color: string | null
}

const items = computed<ChipItem[]>(() => {
  const pending = new Set(encounter.local.pendingIds)
  const acted = new Set(encounter.local.actedIds)
  const currentId = encounter.local.currentActorId
  const ids = [...encounter.local.pendingIds, ...encounter.local.actedIds]
  const out: ChipItem[] = []

  for (const id of ids) {
    const char = chars.byId(id)
    if (!char)
      continue

    const tag = primaryTag(resolveTags(readTagInstances(char), lib.byId))
    out.push({
      char,
      acted: acted.has(id) && !pending.has(id),
      current: id === currentId,
      color: tag?.color ?? null,
    })
  }

  return out
})

function select(id: string) {
  encounter.selectActor(id)
}
</script>

<template>
  <div v-if="items.length > 0" class="flex flex-wrap gap-1">
    <button
      v-for="{ char, acted, current, color } in items"
      :key="char._id"
      type="button"
      class="h-6 border rounded px-2 text-xs transition-colors"
      :class="[current ? 'ring-2 ring-accent' : '', acted ? 'line-through opacity-60' : '']"
      :style="{
        borderColor: color ?? 'rgba(255,255,255,0.2)',
        backgroundColor: color ? `${color}22` : 'rgba(0,0,0,0.3)',
        color: '#fff',
      }"
      :title="acted ? `${char.name}(已行动)` : char.name"
      @click="select(char._id)"
    >
      {{ char.name }}
    </button>
  </div>
</template>
