import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { extractParts } from '@/core/character/parts'
import { useSettingsStore } from '@/stores/settings'

// 全房间角色的 parts 视图,统一缓存。供 RosterList / TargetQuickPicker / ActionForm /
// SceneOverlayLayer 共享,避免每个 computed 各自重新调用 extractParts。
//
// 单例:之前每次调用都 new 一个 computed,N 个组件(尤其每行 RosterRow)各建一份
// 遍历全部角色的 Map → O(N²)。这里全局共享一个 computed,Pinia store 是单例可安全闭包捕获,
// 任一角色变化只重算一次。
let shared: ComputedRef<Map<string, ReturnType<typeof extractParts>>> | null = null

export function usePartsByCharId() {
  if (shared)
    return shared
  const chars = useRoomCharactersStore()
  const settings = useSettingsStore()
  shared = computed(() => {
    const map = new Map<string, ReturnType<typeof extractParts>>()
    for (const c of chars.all)
      map.set(c._id, extractParts(c, settings.statusLabelMap))
    return map
  })
  return shared
}
