<script setup lang="ts">
import type { BatchProgress, SelectedActor } from './types'
import type { VariantOverride } from '@/core/overlay/resolve-display-mode'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed, ref } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { setCharacterHideStatus } from '@/ccfolia/writers/set-character-hide-status'
import { Button } from '@/components/ui'
import { useHpmpVariantOverrideStore } from '@/stores/hpmp-variant-override'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { btnLabel } from './types'

const props = defineProps<{
  selectedActors: SelectedActor[]
}>()

const chars = useRoomCharactersStore()
const overlayVis = useOverlayVisibilityStore()
const variantOverride = useHpmpVariantOverrideStore()

// per-character,选中的多部位 actor 去重到 charId
const overlayCharIds = computed(() => {
  const ids = new Set<string>()
  for (const actor of props.selectedActors)
    ids.add(actor.char._id)
  return [...ids]
})

// 选中角色去重后的完整对象,用于读取 hideStatus 等字段
const overlayChars = computed<CcfoliaCharacter[]>(() => {
  const out: CcfoliaCharacter[] = []
  for (const id of overlayCharIds.value) {
    const c = chars.byId(id)
    if (c)
      out.push(c)
  }
  return out
})

function applyOverlay(visible: boolean) {
  for (const id of overlayCharIds.value) {
    if (visible)
      overlayVis.show(id)
    else
      overlayVis.hide(id)
  }
}

// 在 ccfolia「盤上のキャラクター一覧」里显示/隐藏 —— 写 firestore.hideStatus
const hideStatusProgress = ref<BatchProgress | null>(null)
async function applyHideStatus(hide: boolean) {
  if (overlayCharIds.value.length === 0 || hideStatusProgress.value !== null)
    return
  // 已是目标状态的跳过,减少无意义写
  const targets = overlayChars.value.filter(c => (c.hideStatus === true) !== hide)
  if (targets.length === 0)
    return
  const total = targets.length
  let done = 0
  hideStatusProgress.value = { done: 0, total }
  try {
    const results = await Promise.allSettled(
      targets.map(c => setCharacterHideStatus(c._id, hide).finally(() => {
        done++
        hideStatusProgress.value = { done, total }
      })),
    )
    const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (failures.length > 0) {
      // eslint-disable-next-line no-alert
      alert(`部分写入失败 (${failures.length}/${targets.length}):\n${failures.map(f => (f.reason as Error).message).join('\n')}`)
    }
  }
  finally {
    hideStatusProgress.value = null
  }
}

// 指示器类型(HP/MP variant override)—— 本地 store,同步即可
function applyVariantOverride(mode: VariantOverride) {
  for (const id of overlayCharIds.value)
    variantOverride.set(id, mode)
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-3">
    <p class="text-[11px] text-white/40">
      场景指示均为角色级(非 part 级);多部位角色选中任一 part 即作用于该角色。已选 {{ overlayCharIds.length }} 名角色。
    </p>

    <!-- HP/MP pill 显示(本地) -->
    <div class="flex flex-col gap-1.5">
      <div class="text-xs text-white/70">
        场景上的 HP/MP pill
      </div>
      <div class="flex gap-2">
        <Button size="xs" :disabled="overlayCharIds.length === 0" @click="applyOverlay(true)">
          全部显示 ({{ overlayCharIds.length }})
        </Button>
        <Button size="xs" variant="ghost" :disabled="overlayCharIds.length === 0" @click="applyOverlay(false)">
          全部隐藏 ({{ overlayCharIds.length }})
        </Button>
      </div>
    </div>

    <!-- ccfolia 一览 -->
    <div class="flex flex-col gap-1.5">
      <div class="text-xs text-white/70">
        在 ccfolia 一览中显示
      </div>
      <div class="flex gap-2">
        <Button
          size="xs"
          :loading="hideStatusProgress !== null"
          :disabled="overlayCharIds.length === 0"
          @click="applyHideStatus(false)"
        >
          {{ btnLabel('全部显示', overlayCharIds.length, hideStatusProgress) }}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          :loading="hideStatusProgress !== null"
          :disabled="overlayCharIds.length === 0"
          @click="applyHideStatus(true)"
        >
          {{ btnLabel('全部隐藏', overlayCharIds.length, hideStatusProgress) }}
        </Button>
      </div>
      <p class="text-[11px] text-white/40">
        对应「盤上のキャラクター一覧に表示しない」。
      </p>
    </div>

    <!-- HP/MP 指示器类型(本地 override) -->
    <div class="flex flex-col gap-1.5">
      <div class="text-xs text-white/70">
        HP/MP 指示器类型
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          size="xs"
          variant="ghost"
          :disabled="overlayCharIds.length === 0"
          title="跟随全局自动判定(清除覆盖)"
          @click="applyVariantOverride('auto')"
        >
          <span class="i-lucide-circle-dashed mr-1 text-3.5" />
          自动 ({{ overlayCharIds.length }})
        </Button>
        <Button
          size="xs"
          :disabled="overlayCharIds.length === 0"
          title="强制使用条状指示器"
          @click="applyVariantOverride('C')"
        >
          <span class="i-lucide-rectangle-horizontal mr-1 text-3.5" />
          条状 ({{ overlayCharIds.length }})
        </Button>
        <Button
          size="xs"
          :disabled="overlayCharIds.length === 0"
          title="强制使用药丸指示器"
          @click="applyVariantOverride('E')"
        >
          <span class="i-lucide-pill mr-1 text-3.5" />
          药丸 ({{ overlayCharIds.length }})
        </Button>
      </div>
    </div>
  </div>
</template>
