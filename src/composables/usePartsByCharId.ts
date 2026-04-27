import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { extractParts } from '@/core/character/parts'
import { useSettingsStore } from '@/stores/settings'

// 全房间角色的 parts 视图,统一缓存。供 RosterList / TargetQuickPicker / ActionForm /
// SceneOverlayLayer 共享,避免每个 computed 各自重新调用 extractParts。
export function usePartsByCharId() {
  const chars = useRoomCharactersStore()
  const settings = useSettingsStore()
  return computed(() => {
    const map = new Map<string, ReturnType<typeof extractParts>>()
    for (const c of chars.all)
      map.set(c._id, extractParts(c, settings.statusLabelMap))
    return map
  })
}
