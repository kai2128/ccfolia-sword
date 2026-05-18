<script setup lang="ts">
import type { BatchProgress, SelectedActor } from './types'
import type { BuffBatchTarget } from '@/ccfolia/writers/apply-buff-batch'
import { computed, ref, watch } from 'vue'
import { applyBuffBatch } from '@/ccfolia/writers/apply-buff-batch'
import BuffPicker from '@/components/buffs/BuffPicker.vue'
import { Button, Checkbox, Field, PopConfirm, Select } from '@/components/ui'
import { collectBuffsForPart } from '@/core/buff/collect'
import { useEncounterStore } from '@/stores/encounter'
import { btnLabel } from './types'

const props = defineProps<{
  selectedActors: SelectedActor[]
  selectedCount: number
  sheetOpen: boolean
}>()

const encounter = useEncounterStore()

type BuffMode = 'attach' | 'detach' | 'clear'
const buffMode = ref<BuffMode>('attach')
const clearIncludeAoe = ref(false)
const picker = ref<InstanceType<typeof BuffPicker> | null>(null)
const buffProgress = ref<BatchProgress | null>(null)
const detachDefId = ref('')

watch(() => props.sheetOpen, (v) => {
  if (!v)
    detachDefId.value = ''
})

const buffTargets = computed<BuffBatchTarget[]>(() =>
  props.selectedActors.map(a => ({
    characterId: a.char._id,
    partKey: a.part?.partKey || undefined,
  })),
)

// detach:从选中 actor 各自的 part-buff 列表里取并集(单体 buff,严格按 part)
interface DetachOption { value: string, label: string }
const detachOptions = computed<DetachOption[]>(() => {
  const seen = new Map<string, { name: string, count: number }>()
  for (const actor of props.selectedActors) {
    if (!actor.part)
      continue
    for (const buff of collectBuffsForPart(actor.char, actor.part.partKey)) {
      const cur = seen.get(buff.definitionId)
      if (cur) {
        cur.count++
      }
      else {
        seen.set(buff.definitionId, { name: buff.snapshot.name, count: 1 })
      }
    }
  }
  const list: DetachOption[] = [{ value: '', label: '请选择 Buff' }]
  for (const [defId, info] of seen)
    list.push({ value: defId, label: `${info.name} · ${info.count} 个实例` })
  return list
})

async function applyBuffOp() {
  if (props.selectedCount === 0 || buffProgress.value !== null)
    return

  const targets = buffTargets.value
  if (targets.length === 0)
    return

  buffProgress.value = { done: 0, total: 0 }
  const onProgress = (done: number, total: number) => {
    buffProgress.value = { done, total }
  }
  try {
    if (buffMode.value === 'attach') {
      // 把 picker 引用一次性钉住:applyBuffBatch 触发 firestore snapshot 后,
      // 选中集合 / 视图重算可能让 v-if 短暂失配把 BuffPicker 卸掉,template ref 变 null,
      // 之后再访问 picker.value.commitSaveToLibrary() 就会爆 "Cannot read of null"。
      const inst = picker.value
      if (!inst)
        return
      const prep = inst.prepare()
      if (!prep.ok) {
        // eslint-disable-next-line no-alert
        alert(prep.error)
        return
      }
      const turn = encounter.shared.turn
      await applyBuffBatch({
        kind: 'attach',
        targets,
        buildBuff: target => inst.buildInstance(
          { kind: 'single', characterId: target.characterId, partKey: target.partKey },
          turn,
        ),
      }, { onProgress })
      inst.commitSaveToLibrary()
      inst.reset()
    }
    else if (buffMode.value === 'detach') {
      if (!detachDefId.value) {
        // eslint-disable-next-line no-alert
        alert('请选择要卸下的 Buff')
        return
      }
      await applyBuffBatch({
        kind: 'detach',
        targets,
        definitionId: detachDefId.value,
      }, { onProgress })
    }
    else {
      // clear:不需要选 def,直接清掉选中 part 上所有 single buff。
      // 误点保护由按钮外面包裹的 PopConfirm 提供(buffMode='clear' 才弹气泡)。
      await applyBuffBatch({
        kind: 'clear',
        targets,
        includeAoe: clearIncludeAoe.value,
        // 多部位角色挂在 parent(partKey='')上的 single buff 也一起清掉,
        // 否则选了所有 part 仍会有"整体" buff 残留
        includeParent: true,
      }, { onProgress })
    }
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`批量 buff 操作失败:${(e as Error).message}`)
  }
  finally {
    buffProgress.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-3">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="buffMode === 'attach' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="buffMode = 'attach'"
      >
        挂载
      </button>
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="buffMode === 'detach' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="buffMode = 'detach'"
      >
        卸下
      </button>
      <button
        type="button"
        class="h-7 border rounded px-2 text-xs transition-colors"
        :class="buffMode === 'clear' ? 'border-debuff bg-debuff/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        @click="buffMode = 'clear'"
      >
        清空
      </button>
      <span class="ml-auto text-xs text-white/50">已选 {{ selectedCount }} 个 part</span>
    </div>

    <template v-if="buffMode === 'attach'">
      <BuffPicker ref="picker" force-single />
    </template>
    <template v-else-if="buffMode === 'detach'">
      <Field label="选择要卸下的 Buff" hint="按 definitionId,严格匹配选中 part 上的 single buff">
        <Select v-model="detachDefId" :options="detachOptions" placeholder="选择 Buff" />
      </Field>
      <p v-if="detachOptions.length <= 1 && selectedCount > 0" class="text-xs text-white/40">
        选中的 part 上没有可移除的单体 buff
      </p>
    </template>
    <template v-else>
      <p class="text-xs text-white/60">
        清掉选中 part 上的所有单体 buff。点击应用前会再确认一次。
      </p>
      <label class="flex items-center gap-2 text-xs text-white/70">
        <Checkbox v-model="clearIncludeAoe" />
        连同中心在该角色身上的 AoE buff 一并清掉
      </label>
    </template>

    <div class="flex justify-end pt-1">
      <PopConfirm
        :message="`确认清除 ${selectedCount} 个 part 上的全部 buff${clearIncludeAoe ? '(含 AoE)' : ''}?`"
        confirm-text="清空"
        :bypass="buffMode !== 'clear'"
        @confirm="applyBuffOp"
      >
        <Button
          size="md"
          :variant="buffMode === 'clear' ? 'danger' : 'solid'"
          :loading="buffProgress !== null"
          :disabled="
            selectedCount === 0
              || (buffMode === 'attach' && !picker?.state.valid)
              || (buffMode === 'detach' && !detachDefId)
          "
        >
          {{ btnLabel('应用', selectedCount, buffProgress) }}
        </Button>
      </PopConfirm>
    </div>
  </div>
</template>
