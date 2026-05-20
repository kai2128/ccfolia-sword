import type { SelectedActor } from '@/components/roster/batch-apply/types'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { usePartsByCharId } from '@/composables/usePartsByCharId'
import { parseActorRef } from '@/core/encounter/actor-ref'
import { useRosterSelectionStore } from '@/stores/roster-selection'

// 把 useRosterSelectionStore 里的 part 级 actorRef 解析成 panel 所需的 SelectedActor[]
// 与角色级去重的 uniqueSelectedChars。BatchApplySheet 与 roster tab 内的 quick popover 共用。
export function useRosterSelectionActors() {
  const selection = useRosterSelectionStore()
  const chars = useRoomCharactersStore()
  const partsByCharId = usePartsByCharId()

  const selectedActors = computed<SelectedActor[]>(() => {
    const out: SelectedActor[] = []
    for (const ref of selection.selected) {
      const { charId, partKey } = parseActorRef(ref)
      const char = chars.byId(charId)
      if (!char)
        continue
      const parts = partsByCharId.value.get(charId) ?? []
      const part = parts.find(p => p.partKey === partKey) ?? null
      out.push({ ref, char, part })
    }
    return out
  })

  const selectedCount = computed(() => selectedActors.value.length)

  const uniqueSelectedChars = computed<CcfoliaCharacter[]>(() => {
    const seen = new Set<string>()
    const out: CcfoliaCharacter[] = []
    for (const actor of selectedActors.value) {
      if (seen.has(actor.char._id))
        continue
      seen.add(actor.char._id)
      out.push(actor.char)
    }
    return out
  })

  return { selectedActors, selectedCount, uniqueSelectedChars }
}
