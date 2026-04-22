<script setup lang="ts">
import type { StatusSlot } from '@/core/status-slot'
import { computed, ref } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import AttachBuffDialog from '@/components/buffs/AttachBuffDialog.vue'
import RosterFilterBar from '@/components/roster/RosterFilterBar.vue'
import RosterRow from '@/components/roster/RosterRow.vue'
import RosterSectionHeader from '@/components/roster/RosterSectionHeader.vue'
import { pxToCell } from '@/core/range/grid'
import { groupRoster } from '@/core/roster/group'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const chars = useRoomCharactersStore()
const pieces = usePiecesStore()
const lib = useTagLibraryStore()
const view = useRosterViewStore()
const settings = useSettingsStore()
const expandedId = ref<string | null>(null)
const attachingId = ref<string | null>(null)

// "画布上" = 三个条件同时成立:
//   1) ccfolia 把它当 piece 渲染(active=true + 有 x/y) —— 已被 pieces.list 过滤
//   2) 未被 GM 隐藏(invisible=false)
//   3) 坐标真实落在主板格网范围内 —— 有些 piece 被扔到画布外(x/y 超出 grid.cols/rows),
//      用 pxToCell() 返回 null 即视为"板外"。
// 依赖 settings.grid(cellSizePx / originPx / pieceAnchor / cols / rows)配置正确,
// 否则判定会错乱 —— 格网校准在 settings 里调。
const onCanvasIds = computed(() => {
  const grid = settings.grid
  const ids = new Set<string>()
  for (const piece of pieces.list) {
    if (piece.invisible)
      continue
    if (pxToCell({ x: piece.x, y: piece.y }, grid) === null)
      continue
    ids.add(piece.characterId)
  }
  return ids
})

const groups = computed(() =>
  groupRoster({
    chars: chars.all,
    isOnCanvas: charId => onCanvasIds.value.has(charId),
    byTagId: lib.byId,
    onCanvasOnly: view.onCanvasOnly,
  }),
)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function onChange(charId: string, slot: StatusSlot, newValue: number) {
  const char = chars.byId(charId)
  if (!char)
    return
  try {
    await writeStatusValue({ char, slot, newValue, labelMap: settings.statusLabelMap })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
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
          <RosterRow
            v-for="char in group.chars"
            :key="char._id"
            :char="char"
            :label-map="settings.statusLabelMap"
            :expanded="expandedId === char._id"
            @change="(slot, v) => onChange(char._id, slot, v)"
            @toggle-expand="toggleExpand(char._id)"
            @attach-buff="attachingId = char._id"
          />
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
