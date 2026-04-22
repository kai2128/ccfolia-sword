<script setup lang="ts">
// 紧凑目标选择器:只列 "在画布上" 的角色(active + 非 invisible + 坐标在 grid 内),
// 按 primary tag 分组。点 chip 触发 toggle —— 未选则加入、已选则移除。
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { pxToCell } from '@/core/range/grid'
import { groupRoster } from '@/core/roster/group'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  // 当前已选目标 id —— 点 chip 在这里的会触发 remove;不在则 add
  selectedIds?: string[]
  // 限定候选 id 集合;未传则用 chars.all。BattleTab 里用来限 pending 池
  allowedIds?: string[]
  // 画布上没有可选时的提示文案;默认"画布上没有可选角色"
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', charId: string): void
}>()

const chars = useRoomCharactersStore()
const pieces = usePiecesStore()
const settings = useSettingsStore()
const lib = useTagLibraryStore()

// on-canvas 判定与 RosterList 保持一致
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

const selected = computed(() => new Set(props.selectedIds ?? []))
const allowed = computed(() => props.allowedIds ? new Set(props.allowedIds) : null)

const groups = computed(() => {
  const source = allowed.value
    ? chars.all.filter(c => allowed.value!.has(c._id))
    : chars.all
  return groupRoster({
    chars: source,
    isOnCanvas: id => onCanvasIds.value.has(id),
    byTagId: lib.byId,
    onCanvasOnly: true,
  })
})

function chipStyle(isSelected: boolean, color: string | undefined) {
  if (isSelected) {
    return {
      // 选中态:填色实心 + 深色描边
      borderColor: color ?? 'rgba(255,255,255,0.9)',
      backgroundColor: color ?? 'rgba(255,255,255,0.3)',
      color: '#fff',
    }
  }
  return {
    borderColor: color ?? 'rgba(255,255,255,0.2)',
    backgroundColor: color ? `${color}22` : 'rgba(0,0,0,0.3)',
    color: '#fff',
  }
}
</script>

<template>
  <div v-if="groups.length > 0" class="flex flex-col gap-1">
    <div
      v-for="group in groups"
      :key="group.primaryTagId ?? 'none'"
      class="flex flex-wrap items-center gap-1"
    >
      <span
        v-if="group.primaryTag?.icon"
        :class="group.primaryTag.icon"
        class="shrink-0 text-3.5"
        :style="{ color: group.primaryTag.color }"
        :title="group.primaryTag.label"
      />
      <span
        v-else
        class="shrink-0 text-[10px] text-white/40"
      >
        {{ group.primaryTag?.label ?? '未分类' }}
      </span>
      <button
        v-for="char in group.chars"
        :key="char._id"
        type="button"
        class="h-5 inline-flex items-center gap-0.5 border rounded px-1.5 text-[11px] transition-colors hover:brightness-125"
        :style="chipStyle(selected.has(char._id), group.primaryTag?.color)"
        :title="selected.has(char._id) ? `点击取消:${char.name}` : `点击添加:${char.name}`"
        @click="emit('toggle', char._id)"
      >
        <span v-if="selected.has(char._id)" class="i-lucide-check text-3" />
        {{ char.name }}
      </button>
    </div>
  </div>
  <p v-else class="rounded bg-black/10 py-1 text-center text-[11px] text-white/40">
    {{ emptyText ?? '画布上没有可选角色' }}
  </p>
</template>
