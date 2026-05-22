<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaStatus } from '@/types/ccfolia'
import { computed } from 'vue'
import { getMovableSizes } from '@/ccfolia/movable-size'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import BuffBadgeRow from '@/components/overlay/BuffBadgeRow.vue'
import OverlayCharacterIndicator from '@/components/overlay/OverlayCharacterIndicator.vue'
import StatusChipRow from '@/components/overlay/StatusChipRow.vue'
import { collectBuffs } from '@/core/buff/collect'
import { extractParts } from '@/core/character/parts'
import { computeCrowded } from '@/core/overlay/crowd-detect'
import { resolveDisplayMode } from '@/core/overlay/resolve-display-mode'
import { readStatusSlot } from '@/core/status-slot'
import { useBuffsDerivedStore } from '@/stores/buffs-derived'
import { useEncounterStore } from '@/stores/encounter'
import { useHpmpVariantOverrideStore } from '@/stores/hpmp-variant-override'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useSettingsStore } from '@/stores/settings'
import RangeCircle from './RangeCircle.vue'

// HP/MP 指示器贴在棋子底边下方,留出与 ccfolia 原生角色名的视觉缓冲。
// C 变体含菱形 + 数值列、整体更高且基础 scale 更大,需要稍多 gap 避免与名字挤在一起。
function nameOffsetFor(mode: 'C' | 'E'): number {
  return mode === 'C' ? 7 : 6
}
// 拥挤判定的网格半径 —— 任意其它棋子中心距 ≤ 3 cells 即算「被挤」。
const CROWD_THRESHOLD_CELLS = 3

// 指示器整体缩放:E 已经够小,C 含菱形 + 数值列信息密度高,可以放大。
// transform-origin: top center,缩放后顶边仍贴锚点,只往下"少占"。
const SCALE_REF_WIDTH = 60
const SCALE_MIN = 0.4
// E (pill) — 比 C 轻量,再瘦一档
const E_SCALE_BASE = 0.52
const E_SCALE_MAX = 0.78
// C (diamond bar) — 比 E 大一档,base 提到 0.85,cap 1.1
const C_SCALE_BASE = 0.85
const C_SCALE_MAX = 1.1
function calcIndicatorScale(widthPx: number, mode: 'C' | 'E'): number {
  const ratio = widthPx / SCALE_REF_WIDTH
  const base = mode === 'C' ? C_SCALE_BASE : E_SCALE_BASE
  const max = mode === 'C' ? C_SCALE_MAX : E_SCALE_MAX
  return Math.max(SCALE_MIN, Math.min(max, base * ratio))
}

const pieces = usePiecesStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const overlayVis = useOverlayVisibilityStore()
const variantOverride = useHpmpVariantOverrideStore()
const buffsDerived = useBuffsDerivedStore()
const encounter = useEncounterStore()

const rangeCircleEntries = computed(() =>
  Object.entries(encounter.shared.rangeCircles).map(([characterId, radius]) => ({ characterId, radius })),
)

interface OverlayPart {
  key: string
  label: string
  isMain: boolean
  hp: { value: number, max: number } | null
  mp: { value: number, max: number } | null
}

interface OverlayEntry {
  key: string
  characterId: string
  centerX: number
  // BuffBadgeRow 仍在棋子上方,锚 topY。
  topY: number
  // 棋子底边 y(不含 NAME_OFFSET);最终 HP/MP 锚点 = pieceBottomY + nameOffsetFor(mode),
  // 在 template 里按当前显示变体加 offset。
  pieceBottomY: number
  centerY: number
  widthPx: number
  parts: OverlayPart[]
  buffs: BuffInstance[]
  // 给 StatusChipRow 用,直接传角色原始 status 数组,过滤逻辑在子组件里完成
  status: CcfoliaStatus[]
  isMultipart: boolean
}

const entries = computed<OverlayEntry[]>(() => {
  const sizeMap = getMovableSizes()
  return pieces.list
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
      const self = char ? collectBuffs(char).filter(b => b.attachedTo.kind === 'single') : []
      const aoe = buffsDerived.aoeBuffsCoveringCharacter(p.characterId)
      const buffs = [...self, ...aoe]
      const sized = sizeMap.get(p.characterId)
      const widthPx = sized?.width ?? p.widthCells * settings.grid.cellSizePx
      const heightPx = sized?.height ?? widthPx
      return {
        key: p.characterId,
        characterId: p.characterId,
        centerX: p.x + widthPx / 2,
        topY: p.y,
        pieceBottomY: p.y + heightPx,
        centerY: p.y + heightPx / 2,
        widthPx,
        parts,
        buffs,
        status: char?.status ?? [],
        isMultipart: partsList.length > 1,
      }
    })
})

// 拥挤集合:邻距判定基于全部可见棋子,而非筛过的 entries(后者有 buffs 等冗余)。
const crowdedSet = computed(() => computeCrowded(
  entries.value.map(e => ({ id: e.characterId, centerX: e.centerX, centerY: e.centerY })),
  settings.grid.cellSizePx,
  CROWD_THRESHOLD_CELLS,
))

function modeFor(entry: OverlayEntry): 'C' | 'E' {
  return resolveDisplayMode({
    isMultipart: entry.isMultipart,
    override: variantOverride.get(entry.characterId),
    isCrowded: crowdedSet.value.has(entry.characterId),
    autoSwitchOnCrowded: settings.autoSwitchOnCrowded,
  })
}

// mode 依赖 crowdedSet(又依赖 entries),不能塞进 entries 自身。
// 这里二次 map 一次性算好,模板里直接读 entry.mode,免去原先每 entry 在模板里调 3-4 次 modeFor。
const decoratedEntries = computed(() =>
  entries.value.map(entry => ({ ...entry, mode: modeFor(entry) })),
)
</script>

<template>
  <div class="scene-overlay-layer">
    <RangeCircle
      v-for="rc in rangeCircleEntries"
      :key="`range-${rc.characterId}`"
      :character-id="rc.characterId"
      :radius="rc.radius"
    />
    <template v-for="entry in decoratedEntries" :key="entry.key">
      <!-- Buff badges:沿用棋子上方位置 -->
      <div
        class="anchor"
        :style="{ transform: `translate3d(${entry.centerX}px, ${entry.topY}px, 0)` }"
      >
        <div class="buff-stack">
          <BuffBadgeRow
            v-if="entry.buffs.length > 0"
            :buffs="entry.buffs"
            :piece-width="entry.widthPx"
          />
        </div>
      </div>
      <!-- HP/MP 紧凑指示器:棋子下方,ccfolia 原生角色名之下,按棋子宽度自适应缩放 -->
      <div
        v-if="entry.parts.some(p => p.hp)"
        class="anchor"
        :style="{ transform: `translate3d(${entry.centerX}px, ${entry.pieceBottomY + nameOffsetFor(entry.mode)}px, 0)` }"
      >
        <div
          class="hpmp-stack"
          :style="{ '--mini-scale': calcIndicatorScale(entry.widthPx, entry.mode) }"
        >
          <OverlayCharacterIndicator
            :parts="entry.parts"
            :display-mode="entry.mode"
          />
          <!-- StatusChip:贴 HP/MP 之下,共享同一 --mini-scale。compact 与 HP/MP 的 E 模式同步 -->
          <StatusChipRow
            :status="entry.status"
            :compact="entry.mode === 'E'"
          />
        </div>
      </div>
    </template>
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
/* Buff 行:贴棋子顶边上方,与原行为一致。 */
.buff-stack {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, calc(-100% - 4px));
  display: flex;
  flex-direction: column;
  align-items: center;
  white-space: nowrap;
}
/* HP/MP:从锚点向下定位,锚点本身已经在 ccfolia 名字之下(bottomY 计算时加了 NAME_OFFSET_PX)。
   --mini-scale 由 SceneOverlayLayer 按棋子宽度算出来(0.4-0.85);
   transform-origin top center 确保缩放后顶边仍贴锚点,垂直方向只往下"少占"。 */
.hpmp-stack {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, 0) scale(var(--mini-scale, 1));
  transform-origin: top center;
  display: flex;
  flex-direction: column;
  align-items: center;
  white-space: nowrap;
}
</style>
