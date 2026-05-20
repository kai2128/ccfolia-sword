<script setup lang="ts">
import type { BatchProgress, SelectedActor } from './types'
import type { StatusChange } from '@/ccfolia/writers/apply-action-batch'
import { reactive, ref, watch } from 'vue'
import { applyStatusChangesBatch } from '@/ccfolia/writers/apply-action-batch'
import { Button, Checkbox, Field, Input } from '@/components/ui'
import { resolveNewValue } from '@/core/combat/adjust-hp-mp'
import { applyAdjustment } from '@/core/combat/eval-expr'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'
import { btnLabel } from './types'

const props = defineProps<{
  selectedActors: SelectedActor[]
  selectedCount: number
  sheetOpen: boolean
}>()

const settings = useSettingsStore()

type SlotKind = 'hp' | 'mp'
const hpMp = reactive({
  slot: 'hp' as SlotKind,
  input: '',
  // 默认不截上下限,与单角色 NumberEdit 行为一致(允许过量治疗 / 负血);
  // GM 想限制在 [0, max] 范围内就手动勾上
  clamp: false,
})

const hpMpProgress = ref<BatchProgress | null>(null)

// 关 sheet 时清输入(slot/clampMax 保留)
watch(() => props.sheetOpen, (v) => {
  if (!v)
    hpMp.input = ''
})

// 解析批量输入,直接复用单角色 NumberEdit 的 applyAdjustment,保证语义完全一致:
//   '='          → absolute(允许负)。例:=10 / =-5 / =10+5
//   + / -        → delta,|delta| 按放大方向向上取整(伤害 -3/2 = -1.5 → -2)
//   * / /        → 在 current 上做算术,最终向上取整
//   裸数字/表达式 → absolute。例:10 / 2*5 / (1+2)*3
// 解析失败返 null,调用方跳过该 target。
// 上下限截断由 hpMp.clamp 单一开关控制:勾上 = 截到 [0, max],否则允许越界。
function resolveBatchInput(read: { value: number, max: number }, raw: string): number | null {
  const next = applyAdjustment(raw, read.value)
  if (next === null)
    return null
  return resolveNewValue(read.value, {
    mode: 'absolute',
    input: next,
    max: read.max,
    clampMax: hpMp.clamp,
    clampMin: hpMp.clamp,
  })
}

// 「HP 回满」/「MP 回满」快捷:忽略 input 框,把选中 part 的目标 slot 置 max。
// 已经在 max(或 max 缺失/非有限数)的 part 跳过,避免无意义写。
async function applyRestoreToMax(slot: SlotKind) {
  if (props.selectedCount === 0 || hpMpProgress.value !== null)
    return

  const labelMap = settings.statusLabelMap
  const changes: StatusChange[] = []

  for (const actor of props.selectedActors) {
    if (!actor.part)
      continue
    if (slot === 'mp' && !actor.part.mpLabel)
      continue
    const read = readStatusSlot(actor.char.status, slot, labelMap, actor.part.partKey)
    if (!read)
      continue
    if (!Number.isFinite(read.max))
      continue
    if (read.value === read.max)
      continue
    changes.push({ char: actor.char, slot, newValue: read.max, partPrefix: actor.part.partKey })
  }

  if (changes.length === 0)
    return

  hpMpProgress.value = { done: 0, total: 0 }
  try {
    await applyStatusChangesBatch(changes, labelMap, (done, total) => {
      hpMpProgress.value = { done, total }
    })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`回满失败:${(e as Error).message}`)
  }
  finally {
    hpMpProgress.value = null
  }
}

async function applyHpMp() {
  if (props.selectedCount === 0 || hpMpProgress.value !== null)
    return
  if (!hpMp.input.trim()) {
    // eslint-disable-next-line no-alert
    alert('请输入数字或表达式(+5 / -3 / =10 / 2*5)')
    return
  }

  const labelMap = settings.statusLabelMap
  const changes: StatusChange[] = []
  let invalidExpr = false

  for (const actor of props.selectedActors) {
    if (!actor.part)
      continue
    if (hpMp.slot === 'mp' && !actor.part.mpLabel)
      continue
    const read = readStatusSlot(actor.char.status, hpMp.slot, labelMap, actor.part.partKey)
    if (!read)
      continue
    const newValue = resolveBatchInput(read, hpMp.input)
    if (newValue === null) {
      invalidExpr = true
      continue
    }
    changes.push({ char: actor.char, slot: hpMp.slot, newValue, partPrefix: actor.part.partKey })
  }

  if (invalidExpr && changes.length === 0) {
    // eslint-disable-next-line no-alert
    alert(`表达式无法解析:${hpMp.input}`)
    return
  }

  if (changes.length === 0) {
    // eslint-disable-next-line no-alert
    alert('选中的目标没有可写入的 HP/MP slot')
    return
  }

  hpMpProgress.value = { done: 0, total: 0 }
  try {
    await applyStatusChangesBatch(changes, labelMap, (done, total) => {
      hpMpProgress.value = { done, total }
    })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`批量写入失败:${(e as Error).message}`)
  }
  finally {
    hpMpProgress.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 pt-3">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="h-7 flex items-center gap-1 rounded px-2 transition-colors"
        :class="hpMp.slot === 'hp' ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70'"
        @click="hpMp.slot = 'hp'"
      >
        <span :class="hpMp.slot === 'hp' ? 'i-lucide-circle-dot' : 'i-lucide-circle'" class="text-3" />
        HP
      </button>
      <button
        type="button"
        class="h-7 flex items-center gap-1 rounded px-2 transition-colors"
        :class="hpMp.slot === 'mp' ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70'"
        @click="hpMp.slot = 'mp'"
      >
        <span :class="hpMp.slot === 'mp' ? 'i-lucide-circle-dot' : 'i-lucide-circle'" class="text-3" />
        MP
      </button>
    </div>
    <div class="flex items-end gap-2">
      <Field label="数值(支持表达式)" class="flex-1">
        <Input
          v-model="hpMp.input"
          placeholder="+5 / -3 / =10 / 2*5"
          title="与单角色编辑一致:+5/-3/*2/ 对 current 做算术;=10 absolute(允许负);裸数字/表达式 absolute"
        />
      </Field>
      <Button
        size="md"
        :loading="hpMpProgress !== null"
        :disabled="selectedCount === 0"
        @click="applyHpMp"
      >
        {{ btnLabel('应用', selectedCount, hpMpProgress) }}
      </Button>
    </div>
    <label class="flex items-center gap-2 text-xs text-white/70">
      <Checkbox v-model="hpMp.clamp" />
      不超过上下限(开启以阻止过量治疗 / 伤害)
    </label>
    <div class="flex items-center gap-2 pt-1">
      <span class="text-[11px] text-white/40">快捷:</span>
      <Button
        size="xs"
        :loading="hpMpProgress !== null"
        :disabled="selectedCount === 0"
        title="把选中 part 的 HP 一次性置为 max(忽略数值输入框)"
        @click="applyRestoreToMax('hp')"
      >
        {{ btnLabel('HP 回满', selectedCount, hpMpProgress) }}
      </Button>
      <Button
        size="xs"
        :loading="hpMpProgress !== null"
        :disabled="selectedCount === 0"
        title="把选中 part 的 MP 一次性置为 max(忽略数值输入框);无 MP slot 的 part 跳过"
        @click="applyRestoreToMax('mp')"
      >
        {{ btnLabel('MP 回满', selectedCount, hpMpProgress) }}
      </Button>
    </div>
    <p class="text-[11px] text-white/40">
      多部位角色按勾选的 part 各自写入;MP 仅写有 MP slot 的 part。
    </p>
  </div>
</template>
