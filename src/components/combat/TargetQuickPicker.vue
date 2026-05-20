<script setup lang="ts">
// 紧凑目标选择器:列场上的角色(每个 part 一个 chip),按 primary tag 分组。
// 输入/输出统一用 actorRef(`${charId}::${partKey}`),与 encounter store 同源。
import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { useOnCanvasIds } from '@/composables/useOnCanvasIds'
import { usePartsByCharId } from '@/composables/usePartsByCharId'
import { formatActorDisplayName, formatActorRef } from '@/core/encounter/actor-ref'
import { groupRoster } from '@/core/roster/group'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  selectedIds?: string[]
  allowedIds?: string[]
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', actorRef: string): void
}>()

const chars = useRoomCharactersStore()
const lib = useTagLibraryStore()
const onCanvasIds = useOnCanvasIds()
const partsByCharId = usePartsByCharId()

const selected = computed(() => new Set(props.selectedIds ?? []))
const allowed = computed(() => props.allowedIds ? new Set(props.allowedIds) : null)

interface ChipView {
  ref: string
  label: string
}

interface GroupView {
  primaryTagId: string | null
  primaryTag: ReturnType<typeof lib.byId> | null
  chips: ChipView[]
}

const groups = computed<GroupView[]>(() => {
  const allowSet = allowed.value
  const partsMap = partsByCharId.value
  const sourceChars = allowSet
    ? chars.all.filter(c =>
        (partsMap.get(c._id) ?? []).some(p => allowSet.has(formatActorRef(c._id, p.partKey))),
      )
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
    chips: g.chars.flatMap(c =>
      (partsMap.get(c._id) ?? [])
        .map<ChipView>(p => ({
          ref: formatActorRef(c._id, p.partKey),
          label: formatActorDisplayName(c.name, p.partKey),
        }))
        .filter(chip => !allowSet || allowSet.has(chip.ref)),
    ),
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
    {{ emptyText ?? '场上没有可选角色' }}
  </p>
</template>
