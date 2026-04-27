<script setup lang="ts">
// 紧凑目标选择器:列 "在画布上" 的角色(active + 非 invisible + 坐标在 grid 内),
// 按 primary tag 分组。多部位角色每个 part 渲染独立 chip。
// 输入/输出统一用 actorRef(`${charId}::${partKey}`),与 encounter store 同源。
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { extractParts } from '@/core/character/parts'
import { formatActorRef } from '@/core/encounter/actor-ref'
import { pxToCell } from '@/core/range/grid'
import { groupRoster } from '@/core/roster/group'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  // 已选目标的 actorRef 列表
  selectedIds?: string[]
  // 限定候选 actorRef 集合;未传则用所有画布上的角色 + 它们所有 part
  allowedIds?: string[]
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', actorRef: string): void
}>()

const chars = useRoomCharactersStore()
const pieces = usePiecesStore()
const settings = useSettingsStore()
const lib = useTagLibraryStore()

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

interface ChipView {
  ref: string
  charId: string
  partKey: string
  charName: string
  label: string // 显示文案
}

interface GroupView {
  primaryTagId: string | null
  primaryTag: ReturnType<typeof lib.byId> | null
  chips: ChipView[]
}

const groups = computed<GroupView[]>(() => {
  const allowSet = allowed.value
  // allowed 限定时,先把允许出现的 charId 算出来作为 groupRoster 的输入
  const sourceChars = allowSet
    ? chars.all.filter((c) => {
        // char 的任一 part ref 在 allowed 里则通过
        const parts = extractParts(c, settings.statusLabelMap)
        return parts.some(p => allowSet.has(formatActorRef(c._id, p.partKey)))
      })
    : chars.all

  const baseGroups = groupRoster({
    chars: sourceChars,
    isOnCanvas: id => onCanvasIds.value.has(id),
    byTagId: lib.byId,
    onCanvasOnly: true,
  })

  return baseGroups.map(g => ({
    primaryTagId: g.primaryTagId,
    primaryTag: g.primaryTag,
    chips: g.chars.flatMap((c) => {
      const parts = extractParts(c, settings.statusLabelMap)
      return parts
        .map<ChipView>(p => ({
          ref: formatActorRef(c._id, p.partKey),
          charId: c._id,
          partKey: p.partKey,
          charName: c.name,
          label: p.partKey ? `${c.name} · ${p.partKey}` : c.name,
        }))
        .filter(chip => !allowSet || allowSet.has(chip.ref))
    }),
  }))
})

const hasAny = computed(() => groups.value.some(g => g.chips.length > 0))

function chipStyle(isSelected: boolean, color: string | undefined) {
  if (isSelected) {
    return {
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
  <div v-if="hasAny" class="flex flex-col gap-1">
    <div
      v-for="group in groups"
      :key="group.primaryTagId ?? 'none'"
      class="flex flex-wrap items-center gap-1"
    >
      <template v-if="group.chips.length > 0">
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
          v-for="chip in group.chips"
          :key="chip.ref"
          type="button"
          class="h-5 inline-flex items-center gap-0.5 border rounded px-1.5 text-[11px] transition-colors hover:brightness-125"
          :style="chipStyle(selected.has(chip.ref), group.primaryTag?.color)"
          :title="selected.has(chip.ref) ? `点击取消:${chip.label}` : `点击添加:${chip.label}`"
          @click="emit('toggle', chip.ref)"
        >
          <span v-if="selected.has(chip.ref)" class="i-lucide-check text-3" />
          {{ chip.label }}
        </button>
      </template>
    </div>
  </div>
  <p v-else class="rounded bg-black/10 py-1 text-center text-[11px] text-white/40">
    {{ emptyText ?? '画布上没有可选角色' }}
  </p>
</template>
