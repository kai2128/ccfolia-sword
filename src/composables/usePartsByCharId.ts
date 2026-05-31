import type { ComputedRef } from 'vue'
import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'
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

// per-char 缓存:char 引用不变就复用上次的 parts 数组(extractParts 每次返回新数组,
// 否则 RosterRow 的 partView prop 引用每帧都变 → 行无法跳过重渲染)。
// RTK/Immer 保证未变 entity 跨帧同引用,WeakMap 按 char 对象做键最自然。
// labelMap 变化(罕见,仅 hydrate)时整表失效。
let partsCache = new WeakMap<CcfoliaCharacter, ReturnType<typeof extractParts>>()
let cachedLabelMap: StatusLabelMap | null = null

export function usePartsByCharId() {
  if (shared)
    return shared
  const chars = useRoomCharactersStore()
  const settings = useSettingsStore()
  shared = computed(() => {
    const labelMap = settings.statusLabelMap
    if (labelMap !== cachedLabelMap) {
      partsCache = new WeakMap()
      cachedLabelMap = labelMap
    }
    const map = new Map<string, ReturnType<typeof extractParts>>()
    for (const c of chars.all) {
      let parts = partsCache.get(c)
      if (!parts) {
        parts = extractParts(c, labelMap)
        partsCache.set(c, parts)
      }
      map.set(c._id, parts)
    }
    return map
  })
  return shared
}
