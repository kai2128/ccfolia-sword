<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed } from 'vue'
import { getMovableSizes } from '@/ccfolia/movable-size'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import BuffBadgeRow from '@/components/overlay/BuffBadgeRow.vue'
import OverlayCharacterIndicator from '@/components/overlay/OverlayCharacterIndicator.vue'
import { collectBuffs } from '@/core/buff/collect'
import { extractParts } from '@/core/character/parts'
import { readStatusSlot } from '@/core/status-slot'
import { useBuffsDerivedStore } from '@/stores/buffs-derived'
import { useEncounterStore } from '@/stores/encounter'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useSettingsStore } from '@/stores/settings'
import GridOverlay from './GridOverlay.vue'
import RangeCircle from './RangeCircle.vue'

const pieces = usePiecesStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const overlayVis = useOverlayVisibilityStore()
const buffsDerived = useBuffsDerivedStore()
const encounter = useEncounterStore()

// Record<characterId, radius> → 数组,供 v-for 使用;shared 意味着跨 tab 同步
const rangeCircleEntries = computed(() =>
  Object.entries(encounter.shared.rangeCircles).map(([characterId, radius]) => ({ characterId, radius })),
)

interface OverlayPart {
  key: string
  label: string // 多部位时是 partKey,单部位为空
  isMain: boolean
  hp: { value: number, max: number } | null
  mp: { value: number, max: number } | null
}

interface OverlayEntry {
  key: string
  // piece.x 实测是 .movable 的 canvas-local 左边(不是中心),所以 centerX 要 + offsetWidth/2。
  // piece.y 实测已经是立绘可见顶边的 canvas-local y,直接当 pill 锚点。
  centerX: number
  topY: number
  widthPx: number
  parts: OverlayPart[]
  buffs: BuffInstance[]
}

const entries = computed<OverlayEntry[]>(() => {
  const sizeMap = getMovableSizes()
  return pieces.list
    // ccfolia 的 invisible(立绘不显示)直接不渲染;
    // hideStatus(盤上のキャラクター一覧に表示しない)不参与,本指示器走自己的 toggle。
    .filter(p => !p.invisible && overlayVis.isVisible(p.characterId))
    .map((p) => {
      const char = chars.byId(p.characterId)
      const partsList = char ? extractParts(char, settings.statusLabelMap) : []
      const showLabel = partsList.length > 1
      const parts: OverlayPart[] = char
        ? partsList.map(pv => ({
            key: pv.partKey || 'main',
            label: showLabel ? pv.partKey : '',
            isMain: pv.isMain,
            hp: readStatusSlot(char.status, 'hp', settings.statusLabelMap, pv.partKey),
            mp: pv.mpLabel ? readStatusSlot(char.status, 'mp', settings.statusLabelMap, pv.partKey) : null,
          }))
        : []
      // 本角色的单体 buff + 覆盖本角色的 AoE buff(AoE buff 本身挂在中心角色,不在 collectBuffs(char) 里)
      const self = char ? collectBuffs(char).filter(b => b.attachedTo.kind === 'single') : []
      const aoe = buffsDerived.aoeBuffsCoveringCharacter(p.characterId)
      const buffs = [...self, ...aoe]
      // DOM 里量到的直接用;没量到(时机问题)回落到 widthCells × cellSizePx
      const widthPx = sizeMap.get(p.characterId)?.width ?? p.widthCells * settings.grid.cellSizePx
      return {
        key: p.characterId,
        centerX: p.x + widthPx / 2,
        topY: p.y,
        widthPx,
        parts,
        buffs,
      }
    })
})
</script>

<template>
  <div class="scene-overlay-layer">
    <!-- 格网校准叠加,仅 settings.gridOverlayVisible=true 时渲染 -->
    <GridOverlay />
    <!-- AoE 圆已从画布移除:AoE 作用范围只在 BuffRow 的 "AoE Nm" 角标 + 覆盖徽章反映。 -->
    <!-- 射程圈:青虚线,纯视觉、不参与结算 -->
    <!-- TODO: piece 气泡入口。overlay 宿主 pointer-events: none,需要另装 click 监听(scene-mount 上未暴露) -->
    <RangeCircle
      v-for="rc in rangeCircleEntries"
      :key="`range-${rc.characterId}`"
      :character-id="rc.characterId"
      :radius="rc.radius"
    />
    <div
      v-for="entry in entries"
      :key="entry.key"
      class="anchor"
      :style="{ transform: `translate3d(${entry.centerX}px, ${entry.topY}px, 0)` }"
    >
      <div class="indicator-stack">
        <BuffBadgeRow
          v-if="entry.buffs.length > 0"
          :buffs="entry.buffs"
          :piece-width="entry.widthPx"
        />
        <OverlayCharacterIndicator
          v-if="entry.parts.some(p => p.hp)"
          :parts="entry.parts"
          :width-px="entry.widthPx"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.anchor {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}
.indicator-stack {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, calc(-100% - 16px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
</style>
