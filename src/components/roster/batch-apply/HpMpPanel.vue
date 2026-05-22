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

const props = defineProps<{
  selectedActors: SelectedActor[]
  selectedCount: number
  // popover / sheet 用:从开到关时清空输入。内联 compact 模式不传,输入常驻。
  sheetOpen?: boolean
  // compact:内联挂在 selection bar 下方时的紧凑两行布局。
  compact?: boolean
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

// 哪个动作正在跑 —— 只让被点的那个按钮转 spinner / 显示进度,其余 disable。
// (之前所有按钮共享 loading,compact 下会同时撑开导致文字溢出。)
type ActionKey = 'apply' | 'add' | 'sub' | 'restore-hp' | 'restore-mp'
const busy = ref<ActionKey | null>(null)

// 闲时:`label (count)`;运行中只显示 `done/total`(短,compact 不溢出)。
function lbl(base: string, key: ActionKey): string {
  if (busy.value === key && hpMpProgress.value)
    return `${hpMpProgress.value.done}/${hpMpProgress.value.total}`
  return `${base} (${props.selectedCount})`
}
// 任一动作在跑时锁住其它按钮(自己那个靠 loading 自然 disable)。
function locked(key: ActionKey): boolean {
  return props.selectedCount === 0 || (busy.value !== null && busy.value !== key)
}

// 关 sheet 时清输入(slot/clampMax 保留);compact 内联模式不清,输入常驻
watch(() => props.sheetOpen, (v) => {
  if (!props.compact && !v)
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
  if (busy.value !== null || props.selectedCount === 0)
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

  busy.value = slot === 'hp' ? 'restore-hp' : 'restore-mp'
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
    busy.value = null
  }
}

// 三个应用入口共用:raw 已是最终喂给 applyAdjustment 的字符串
// (= absolute / +- delta / 裸表达式 absolute),逐 part 解析后一次性写回。
async function applyRaw(raw: string, key: ActionKey) {
  if (busy.value !== null || props.selectedCount === 0)
    return

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
    const newValue = resolveBatchInput(read, raw)
    if (newValue === null) {
      invalidExpr = true
      continue
    }
    changes.push({ char: actor.char, slot: hpMp.slot, newValue, partPrefix: actor.part.partKey })
  }

  if (invalidExpr && changes.length === 0) {
    // eslint-disable-next-line no-alert
    alert(`表达式无法解析:${raw}`)
    return
  }

  if (changes.length === 0) {
    // eslint-disable-next-line no-alert
    alert('选中的目标没有可写入的 HP/MP slot')
    return
  }

  busy.value = key
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
    busy.value = null
  }
}

// 「应用」:按输入框原样语义(= absolute / +- delta / 裸表达式 absolute)。
function applyHpMp() {
  if (!hpMp.input.trim()) {
    // eslint-disable-next-line no-alert
    alert('请输入数字或表达式(+5 / -3 / =10 / 2*5)')
    return
  }
  applyRaw(hpMp.input, 'apply')
}

// 「应用为减 / 应用为加」:把输入当量级(剥掉用户可能手打的 =/+/-),
// 强制套 -/+ 前缀走 delta —— 逐 part 各自 current ∓ 量,沿用 NumberEdit 的进位语义。
function applyDelta(sign: '+' | '-') {
  const magnitude = hpMp.input.trim().replace(/^[=+-]/, '')
  if (!magnitude) {
    // eslint-disable-next-line no-alert
    alert('请输入数值(例:5 / 2*3)')
    return
  }
  applyRaw(sign + magnitude, sign === '+' ? 'add' : 'sub')
}
</script>

<template>
  <div class="flex flex-col" :class="compact ? 'gap-1.5' : 'gap-2 pt-3'">
    <!-- 第一组:HP/MP 开关 + 数值输入 + 应用。
         compact 用 flex 挤成一行;full 用 display:contents 让开关与输入各自独占一行(原布局)。 -->
    <div :class="compact ? 'flex flex-wrap items-end gap-2' : 'contents'">
      <!-- HP / MP 单按钮:显示当前 slot,点击切换。HP 绿 / MP 蓝 -->
      <button
        type="button"
        class="h-7 flex shrink-0 items-center gap-1 rounded-md px-3 text-xs text-white font-medium shadow-sm transition-colors hover:brightness-110"
        :class="hpMp.slot === 'hp' ? 'bg-capsule-hp-2' : 'bg-capsule-mp-2'"
        :title="`正在编辑 ${hpMp.slot === 'hp' ? 'HP' : 'MP'} · 点击切到 ${hpMp.slot === 'hp' ? 'MP' : 'HP'}`"
        @click="hpMp.slot = hpMp.slot === 'hp' ? 'mp' : 'hp'"
      >
        <span :class="hpMp.slot === 'hp' ? 'i-lucide-heart' : 'i-lucide-droplet'" class="text-3" />
        {{ hpMp.slot === 'hp' ? 'HP' : 'MP' }}
        <span class="i-lucide-arrow-left-right text-2.5 opacity-50" />
      </button>
      <div class="flex flex-1 items-end gap-2">
        <Field :label="compact ? undefined : '数值(支持表达式)'" class="flex-1">
          <Input
            v-model="hpMp.input"
            placeholder="+5 / -3 / =10 / 2*5"
            title="与单角色编辑一致:+5/-3/*2/ 对 current 做算术;=10 absolute(允许负);裸数字/表达式 absolute"
          />
        </Field>
        <Button
          :size="compact ? 'sm' : 'md'"
          :loading="busy === 'apply'"
          :disabled="locked('apply')"
          @click="applyHpMp"
        >
          {{ lbl('应用', 'apply') }}
        </Button>
        <!-- compact:clamp 收到输入行尾,省一行 -->
        <label
          v-if="compact"
          class="flex shrink-0 select-none items-center self-center gap-1 text-[11px] text-white/60"
          title="勾上:不超过 [0, max](阻止过量治疗 / 击穿 0)"
        >
          <Checkbox v-model="hpMp.clamp" />
          不超限
        </label>
      </div>
    </div>

    <!-- clamp:full 单独一行;compact 时下移到增减/回满那一行尾 -->
    <label v-if="!compact" class="flex items-center gap-2 text-xs text-white/70">
      <Checkbox v-model="hpMp.clamp" />
      不超过上下限(开启以阻止过量治疗 / 伤害)
    </label>

    <!-- 第二组:compact 两端对齐(快捷左 · 增减右);
         full 竖排用 flex-col-reverse —— DOM 是 快捷→增减,反向后变 增减 在上、回满 在下。 -->
    <div :class="compact ? 'flex items-center justify-between gap-2 pt-1' : 'flex flex-col-reverse gap-2 pt-1'">
      <!-- 回满:HP 绿 / MP 蓝 -->
      <div class="flex items-center gap-2 pt-1">
        <span class="text-[11px] text-white/40">快捷:</span>
        <Button
          size="xs"
          variant="hp"
          :loading="busy === 'restore-hp'"
          :disabled="locked('restore-hp')"
          title="把选中 part 的 HP 一次性置为 max(忽略数值输入框)"
          @click="applyRestoreToMax('hp')"
        >
          {{ lbl('HP 回满', 'restore-hp') }}
        </Button>
        <Button
          size="xs"
          variant="mp"
          :loading="busy === 'restore-mp'"
          :disabled="locked('restore-mp')"
          title="把选中 part 的 MP 一次性置为 max(忽略数值输入框);无 MP slot 的 part 跳过"
          @click="applyRestoreToMax('mp')"
        >
          {{ lbl('MP 回满', 'restore-mp') }}
        </Button>
      </div>
      <!-- 增减:应用为加(绿/+)在前,应用为减(红/−)在后。把输入当量级,逐 part 各自 current ± 量 -->
      <div class="flex items-center gap-2 pt-1">
        <span class="text-[11px] text-white/40">增减:</span>
        <Button
          size="xs"
          variant="success"
          :loading="busy === 'add'"
          :disabled="locked('add')"
          title="把输入当量级,对选中 part 各自 current + 量(支持表达式;clamp 照旧)"
          @click="applyDelta('+')"
        >
          <span v-if="busy !== 'add'" class="i-lucide-plus text-3" />
          {{ lbl('应用为加', 'add') }}
        </Button>
        <Button
          size="xs"
          variant="danger"
          :loading="busy === 'sub'"
          :disabled="locked('sub')"
          title="把输入当量级,对选中 part 各自 current − 量(支持表达式;clamp 照旧)"
          @click="applyDelta('-')"
        >
          <span v-if="busy !== 'sub'" class="i-lucide-minus text-3" />
          {{ lbl('应用为减', 'sub') }}
        </Button>
      </div>
    </div>

    <p v-if="!compact" class="text-[11px] text-white/40">
      多部位角色按勾选的 part 各自写入;MP 仅写有 MP slot 的 part。
    </p>
  </div>
</template>
