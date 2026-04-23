import type { BuffInstance } from '@/types/buff-v3'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { computeCoverage } from '@/core/buff/aoe'
import { collectBuffs } from '@/core/buff/collect'
import { useSettingsStore } from '@/stores/settings'

// 派生响应式 store:所有 AoE 相关的"跨 character 聚合"都从这里读。
// 不落盘、不写 ccfolia,是 collectBuffs + computeCoverage 的响应式包装。
export const useBuffsDerivedStore = defineStore('buffsDerived', () => {
  const characters = useRoomCharactersStore()
  const pieces = usePiecesStore()
  const settings = useSettingsStore()

  // 全部 AoE buff(按 centerCharacterId 聚在中心角色的 params 里)
  const allAoeBuffs = computed<BuffInstance[]>(() => {
    const out: BuffInstance[] = []
    for (const c of characters.all) {
      for (const b of collectBuffs(c)) {
        if (b.attachedTo.kind === 'aoe')
          out.push(b)
      }
    }
    return out
  })

  // buffId → 覆盖集合
  const coverageByBuff = computed<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>()
    for (const b of allAoeBuffs.value)
      map.set(b.id, computeCoverage(b, pieces.list, settings.grid))
    return map
  })

  // 返回覆盖某角色的所有 AoE buff(不过滤 enabled,消费方按需过滤)
  function aoeBuffsCoveringCharacter(characterId: string): BuffInstance[] {
    return allAoeBuffs.value.filter((b) => {
      const cov = coverageByBuff.value.get(b.id)
      return cov?.has(characterId) ?? false
    })
  }

  return {
    allAoeBuffs,
    coverageByBuff,
    aoeBuffsCoveringCharacter,
  }
})
