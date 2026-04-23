<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed, ref, watch } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { updateAoeCoverage } from '@/ccfolia/writers/update-aoe-coverage'
import { Button, Dialog } from '@/components/ui'
import { computeCoverage } from '@/core/buff/aoe'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  buff: BuffInstance // 约束:attachedTo.kind === 'aoe'
  centerCharacterId: string
  open: boolean
}>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const characters = useRoomCharactersStore()
const pieces = usePiecesStore()
const settings = useSettingsStore()
const busy = ref(false)

// 自动覆盖 = 当前 radius 下在圈内的(忽略已有 override 看"自然")
const autoSet = computed<Set<string>>(() => {
  if (props.buff.attachedTo.kind !== 'aoe')
    return new Set()
  const plainBuff: BuffInstance = {
    ...props.buff,
    attachedTo: {
      kind: 'aoe',
      centerCharacterId: props.buff.attachedTo.centerCharacterId,
      radius: props.buff.attachedTo.radius,
    },
  }
  return computeCoverage(plainBuff, pieces.list, settings.grid)
})

const allCharacterIds = computed(() => pieces.list.map(p => p.characterId))

const includeDraft = ref<Set<string>>(new Set())
const excludeDraft = ref<Set<string>>(new Set())

// 打开 dialog 时同步 draft
watch(
  () => props.open,
  (open) => {
    if (!open)
      return
    if (props.buff.attachedTo.kind === 'aoe') {
      includeDraft.value = new Set(props.buff.attachedTo.includeOverride ?? [])
      excludeDraft.value = new Set(props.buff.attachedTo.excludeOverride ?? [])
    }
    else {
      includeDraft.value = new Set()
      excludeDraft.value = new Set()
    }
  },
  { immediate: true },
)

function toggleInclude(id: string) {
  const s = new Set(includeDraft.value)
  if (s.has(id))
    s.delete(id)
  else s.add(id)
  includeDraft.value = s
}

function toggleExclude(id: string) {
  const s = new Set(excludeDraft.value)
  if (s.has(id))
    s.delete(id)
  else s.add(id)
  excludeDraft.value = s
}

async function save() {
  if (busy.value || props.buff.attachedTo.kind !== 'aoe')
    return
  busy.value = true
  try {
    await updateAoeCoverage(
      props.centerCharacterId,
      props.buff.id,
      Array.from(includeDraft.value),
      Array.from(excludeDraft.value),
    )
    emit('update:open', false)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`保存失败:${(error as Error).message}`)
  }
  finally {
    busy.value = false
  }
}

function close() {
  emit('update:open', false)
}

function charName(id: string): string {
  return characters.byId(id)?.name ?? id
}
</script>

<template>
  <Dialog
    :open="open"
    :title="`调整 AoE 覆盖:${buff.snapshot.name}`"
    @update:open="emit('update:open', $event)"
  >
    <div class="flex flex-col gap-3 text-xs text-white">
      <section class="border border-white/10 rounded bg-black/20 px-2 py-1.5">
        <h4 class="mb-1 text-white/80">
          自动覆盖角色(勾选 = 强制排除)
        </h4>
        <div class="flex flex-col gap-0.5">
          <label
            v-for="id in allCharacterIds"
            v-show="autoSet.has(id)"
            :key="id"
            class="flex items-center gap-2"
          >
            <input
              type="checkbox"
              :checked="excludeDraft.has(id)"
              @change="toggleExclude(id)"
            >
            {{ charName(id) }}
          </label>
          <div v-if="autoSet.size === 0" class="text-white/40">
            无
          </div>
        </div>
      </section>
      <section class="border border-white/10 rounded bg-black/20 px-2 py-1.5">
        <h4 class="mb-1 text-white/80">
          非自动覆盖角色(勾选 = 强制加入)
        </h4>
        <div class="flex flex-col gap-0.5">
          <label
            v-for="id in allCharacterIds"
            v-show="!autoSet.has(id)"
            :key="id"
            class="flex items-center gap-2"
          >
            <input
              type="checkbox"
              :checked="includeDraft.has(id)"
              @change="toggleInclude(id)"
            >
            {{ charName(id) }}
          </label>
        </div>
      </section>
      <div class="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" @click="close">
          取消
        </Button>
        <Button size="sm" :disabled="busy" @click="save">
          保存
        </Button>
      </div>
    </div>
  </Dialog>
</template>
