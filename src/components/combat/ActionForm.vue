<script setup lang="ts">
import type { SummaryRow } from './ResultSummary.vue'
import type { StatusChange } from '@/ccfolia/writers/apply-action-batch'
import type { ActionDraft, ActionTarget, DamageType, ResistType } from '@/types/action'
import { computed, ref, toRefs, watch } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { applyStatusChangesBatch } from '@/ccfolia/writers/apply-action-batch'
import { useFirestoreReady } from '@/composables/useFirestoreReady'
import { applyDamageToTarget, validateDraft } from '@/core/combat/apply-damage'
import { applyHealToTarget } from '@/core/combat/apply-heal'
import { collectDefenseMods, resolveDefense } from '@/core/combat/resolve-modifiers'
import { readStatusSlot } from '@/core/status-slot'
import { useActionDraftStore } from '@/stores/action-draft'
import { useEncounterStore } from '@/stores/encounter'
import { useSettingsStore } from '@/stores/settings'
import ResultSummary from './ResultSummary.vue'
import TargetQuickPicker from './TargetQuickPicker.vue'
import TargetRow from './TargetRow.vue'

const props = defineProps<{
  actorId?: string | null
}>()

interface TargetRowVm {
  charId: string
  charName: string
  defenseText?: string
  preview: string
  canApply: boolean
  target: ActionTarget
  newHp: number
  currentHp: number | null
  finalValue: number | null
}

const settings = useSettingsStore()
const chars = useRoomCharactersStore()
const encounter = useEncounterStore()
const { ready: firestoreReady } = useFirestoreReady()

const draftStore = useActionDraftStore()
const {
  kind,
  damageType,
  resistType,
  rawValue,
  hitValue,
  mpCost,
  note,
  targets,
  mpConsumed,
} = toRefs(draftStore)

const writing = ref(false)
const writeError = ref('')

function defaultResistFor(type: DamageType): ResistType {
  return type === 'magical' ? 'mental' : 'evasion'
}

watch(kind, (value) => {
  // heal 没有抵抗概念;切回 damage 时按 damageType 恢复默认。
  resistType.value = value === 'heal' ? 'none' : defaultResistFor(damageType.value)
})

// 切换伤害类型时自动选对应的默认抵抗;用户随后可手动改成其它值,直到下次再切 damageType。
watch(damageType, (value) => {
  if (kind.value === 'damage')
    resistType.value = defaultResistFor(value)
})

// 切换行动者或行动类型时,命中/行使值应归零,避免串到下一个角色。
watch([() => props.actorId, kind], () => {
  hitValue.value = undefined
})

function resetCast() {
  mpConsumed.value = false
}

watch(
  () => targets.value.length,
  (next, previous) => {
    if ((previous ?? 0) === 0 && next > 0)
      resetCast()
  },
)

watch([mpCost, kind, () => props.actorId], resetCast)

const hitValueLabel = computed(() => (damageType.value === 'magical' ? '行使值' : '命中值'))
const actor = computed(() => (props.actorId ? chars.byId(props.actorId) ?? null : null))
const actorMp = computed(() => {
  if (!actor.value)
    return null
  return readStatusSlot(actor.value.status, 'mp', settings.statusLabelMap)?.value ?? null
})
const valueLabel = computed(() => (kind.value === 'heal' ? '治疗' : '伤害'))

const draft = computed<ActionDraft>(() => ({
  id: 'current-draft',
  kind: kind.value,
  damageType: kind.value === 'damage' ? damageType.value : undefined,
  rawValue: rawValue.value,
  actorCharacterId: props.actorId ?? undefined,
  mpCost: mpCost.value,
  resistType: resistType.value,
  note: note.value,
  targets: targets.value,
}))

function addTarget(characterId: string) {
  if (!characterId)
    return
  if (targets.value.some(target => target.characterId === characterId))
    return
  targets.value.push({ characterId })
}

function removeTarget(characterId: string) {
  targets.value = targets.value.filter(target => target.characterId !== characterId)
}

function toggleTarget(characterId: string) {
  if (targets.value.some(target => target.characterId === characterId))
    removeTarget(characterId)
  else
    addTarget(characterId)
}

function endActorTurn() {
  if (props.actorId)
    encounter.finishActor(props.actorId)
}

function updateTarget(characterId: string, next: ActionTarget) {
  targets.value = targets.value.map(target =>
    target.characterId === characterId ? next : target,
  )
}

function buildPreviewVm(target: ActionTarget): TargetRowVm {
  const char = chars.byId(target.characterId)
  if (!char) {
    return {
      charId: target.characterId,
      charName: '???',
      preview: '—',
      canApply: false,
      target,
      newHp: 0,
      currentHp: null,
      finalValue: null,
    }
  }

  const hp = readStatusSlot(char.status, 'hp', settings.statusLabelMap)
  if (!hp) {
    return {
      charId: target.characterId,
      charName: char.name,
      preview: '缺少 HP',
      canApply: false,
      target,
      newHp: 0,
      currentHp: null,
      finalValue: null,
    }
  }

  const defenseText = kind.value === 'damage' && damageType.value === 'physical'
    ? `防御 ${resolveDefense(char.status, settings.statusLabelMap, collectDefenseMods(char))}`
    : undefined

  // 抵抗未裁决时 applyDamageToTarget 会抛 `missing resistResult`。这里短路,
  // 让 TargetRow 的 preview 直接显示"待裁决"而不是把异常文案漏给 GM。
  if (kind.value === 'damage' && resistType.value !== 'none' && !target.resistResult) {
    return {
      charId: target.characterId,
      charName: char.name,
      defenseText,
      preview: '待裁决',
      canApply: false,
      target,
      newHp: hp.value,
      currentHp: hp.value,
      finalValue: null,
    }
  }

  try {
    if (kind.value === 'heal') {
      const result = applyHealToTarget(draft.value, target, { currentHp: hp.value, maxHp: hp.max })
      return {
        charId: target.characterId,
        charName: char.name,
        defenseText,
        preview: String(result.healedAmount),
        canApply: true,
        target,
        newHp: result.newHp,
        currentHp: hp.value,
        finalValue: result.healedAmount,
      }
    }

    const result = applyDamageToTarget(
      draft.value,
      target,
      { status: char.status, mods: collectDefenseMods(char), currentHp: hp.value },
      settings.statusLabelMap,
    )

    const canApply = draft.value.resistType === 'none' || !!target.resistResult
    return {
      charId: target.characterId,
      charName: char.name,
      defenseText,
      preview: String(result.finalDamage),
      canApply,
      target,
      newHp: result.newHp,
      currentHp: hp.value,
      // 抵抗未裁决时 preview 的数字实际是"抵抗失败"分支,summary 里先不显示以免误导。
      finalValue: canApply ? result.finalDamage : null,
    }
  }
  catch (error) {
    return {
      charId: target.characterId,
      charName: char.name,
      defenseText,
      preview: error instanceof Error ? error.message : '结算失败',
      canApply: false,
      target,
      newHp: hp.value,
      currentHp: hp.value,
      finalValue: null,
    }
  }
}

const vms = computed<TargetRowVm[]>(() => targets.value.map(buildPreviewVm))

const summaryRows = computed<SummaryRow[]>(() =>
  vms.value.flatMap((vm) => {
    if (vm.currentHp === null || vm.finalValue === null)
      return []
    return [{
      charName: vm.charName,
      finalValue: vm.finalValue,
      currentHp: vm.currentHp,
      newHp: vm.newHp,
      resistResult: vm.target.resistResult,
      resistOutcome: vm.target.resistOutcome,
    }]
  }),
)

const canApplyMp = computed(() =>
  !!props.actorId
  && mpCost.value > 0
  && !mpConsumed.value
  && actorMp.value !== null
  && firestoreReady.value
  && !writing.value,
)

interface FlowStep {
  key: string
  label: string
  done: boolean
}

const flowSteps = computed(() => {
  const valueReady = rawValue.value > 0
  const targetsReady = vms.value.length > 0
  const resistReady = resistType.value === 'none'
    || (targetsReady && targets.value.every(target => !!target.resistResult))

  const items: FlowStep[] = [
    { key: 'value', label: valueLabel.value, done: valueReady },
    { key: 'targets', label: '目标', done: targetsReady },
  ]
  if (kind.value === 'damage' && resistType.value !== 'none')
    items.push({ key: 'resist', label: '抵抗', done: resistReady })
  items.push({ key: 'apply', label: '应用', done: false })

  const firstPending = items.findIndex(item => !item.done)
  const activeIndex = firstPending < 0 ? items.length - 1 : firstPending
  return items.map((item, index) => ({ ...item, active: index === activeIndex }))
})

async function runWrite(
  buildChanges: () => StatusChange[],
  onSuccess: () => void,
): Promise<void> {
  if (writing.value)
    return

  if (!firestoreReady.value) {
    writeError.value = '等待 ccfolia 加载(SDK 未就绪)…'
    return
  }

  writing.value = true
  writeError.value = ''

  try {
    const changes = buildChanges()
    if (changes.length === 0)
      return
    await applyStatusChangesBatch(changes, settings.statusLabelMap)
    onSuccess()
  }
  catch (error) {
    writeError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    writing.value = false
  }
}

function buildMpChange(): StatusChange | null {
  if (mpConsumed.value)
    return null
  if (!props.actorId || mpCost.value <= 0)
    return null

  const current = chars.byId(props.actorId)
  if (!current)
    return null

  const mp = readStatusSlot(current.status, 'mp', settings.statusLabelMap)
  if (!mp)
    return null

  return {
    char: current,
    slot: 'mp',
    newValue: Math.max(0, mp.value - mpCost.value),
  }
}

async function applyMpOnly() {
  await runWrite(
    () => {
      const change = buildMpChange()
      return change ? [change] : []
    },
    () => {
      mpConsumed.value = true
    },
  )
}

async function applyOne(vm: TargetRowVm) {
  try {
    validateDraft({ ...draft.value, targets: [vm.target] })
  }
  catch (error) {
    writeError.value = error instanceof Error ? error.message : String(error)
    return
  }

  let chargedMp = false
  await runWrite(
    () => {
      const char = chars.byId(vm.charId)
      if (!char)
        return []

      const changes: StatusChange[] = [{ char, slot: 'hp', newValue: vm.newHp }]
      const mpChange = buildMpChange()
      if (mpChange) {
        changes.push(mpChange)
        chargedMp = true
      }
      return changes
    },
    () => {
      if (chargedMp)
        mpConsumed.value = true
      removeTarget(vm.charId)
    },
  )
}

async function applyAll() {
  // 只校验真的能应用的目标,避免未裁决抵抗的目标冒出 `missing resistResult` 提示。
  const applicable = vms.value.filter(vm => vm.canApply).map(vm => vm.target)
  if (applicable.length === 0)
    return

  try {
    validateDraft({ ...draft.value, targets: applicable })
  }
  catch (error) {
    writeError.value = error instanceof Error ? error.message : String(error)
    return
  }

  let chargedMp = false
  await runWrite(
    () => {
      const changes: StatusChange[] = vms.value.flatMap((vm) => {
        if (!vm.canApply)
          return []
        const char = chars.byId(vm.charId)
        return char ? [{ char, slot: 'hp' as const, newValue: vm.newHp }] : []
      })

      const mpChange = buildMpChange()
      if (mpChange) {
        changes.push(mpChange)
        chargedMp = true
      }
      return changes
    },
    () => {
      if (chargedMp)
        mpConsumed.value = true
      targets.value = targets.value.filter(target =>
        // 保留未裁决抵抗的目标,让 GM 回头再处理。
        !vms.value.find(vm => vm.target === target)?.canApply,
      )
    },
  )
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <!-- 流程指示条:参考 ResolverPanel/FlowBar,告诉 GM 当前卡在哪一步 -->
    <div class="flex flex-wrap items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs">
      <template v-for="(step, index) in flowSteps" :key="step.key">
        <span
          class="h-7 inline-flex items-center gap-1 rounded px-2"
          :class="[
            step.active ? 'bg-accent/20 text-accent' : step.done ? 'text-white/80' : 'text-white/40',
          ]"
        >
          <span v-if="step.done" class="i-lucide-check text-3" />
          <span v-else-if="step.active" class="i-lucide-circle-dot text-3" />
          <span v-else class="i-lucide-circle text-3" />
          {{ step.label }}
        </span>
        <span v-if="index < flowSteps.length - 1" class="text-white/20">→</span>
      </template>
    </div>

    <!-- 行动头 -->
    <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
      <div class="text-xs text-white/60 font-medium">
        行动
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-white/80">
        <label class="inline-flex items-center gap-1">
          <input v-model="kind" type="radio" value="damage">
          <span>伤害</span>
        </label>
        <label class="inline-flex items-center gap-1">
          <input v-model="kind" type="radio" value="heal">
          <span>治疗</span>
        </label>
        <template v-if="kind === 'damage'">
          <label class="inline-flex items-center gap-1">
            <span>类型</span>
            <select v-model="damageType" class="border border-white/10 rounded bg-surface px-2 py-1 text-white">
              <option value="physical">
                物理
              </option>
              <option value="magical">
                魔法
              </option>
            </select>
          </label>
          <label class="inline-flex items-center gap-1">
            <span>抵抗</span>
            <select v-model="resistType" class="border border-white/10 rounded bg-surface px-2 py-1 text-white">
              <option value="none">
                无
              </option>
              <option value="evasion">
                闪避
              </option>
              <option value="mental">
                精神抵抗
              </option>
              <option value="life">
                生命抵抗
              </option>
            </select>
          </label>
          <label
            v-if="resistType !== 'none'"
            class="inline-flex items-center gap-1"
            :title="`${hitValueLabel}仅作参考,GM 凭此判定每个目标的抵抗成败`"
          >
            <span>{{ hitValueLabel }}</span>
            <input
              v-model.number="hitValue"
              type="number"
              min="0"
              step="1"
              class="w-16 border border-white/10 rounded bg-surface px-2 py-1 text-white"
            >
          </label>
        </template>
        <!-- MP 消耗 + 单独扣除按钮:GM 常用场景是吟唱即扣 MP,不用等伤害结算。 -->
        <label
          class="inline-flex items-center gap-1"
          :title="actorMp !== null ? `当前 MP ${actorMp}` : '选中行动者后显示当前 MP'"
        >
          <span>MP</span>
          <input
            v-model.number="mpCost"
            type="number"
            min="0"
            step="1"
            class="w-16 border border-white/10 rounded bg-surface px-2 py-1 text-white"
          >
        </label>
        <button
          type="button"
          class="h-7 rounded px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :class="mpConsumed ? 'bg-white/5 text-white/50' : 'bg-mp/80 text-white hover:bg-mp'"
          :disabled="!canApplyMp"
          :title="mpConsumed ? '已扣过,切换行动者或修改 MP 可重置' : (actorMp !== null && mpCost > 0 ? `扣 MP:${actorMp} → ${Math.max(0, actorMp - mpCost)}` : '需要行动者 + MP > 0')"
          @click="applyMpOnly"
        >
          {{ mpConsumed ? '已扣' : '扣 MP' }}
        </button>
      </div>
    </div>

    <!-- 数值面板 -->
    <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
      <div class="text-xs text-white/60 font-medium">
        数值
        <span class="text-white/40">· 查威力表后填入</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs text-white/80">
        <label class="flex flex-col gap-1">
          <span>{{ valueLabel }}</span>
          <input
            v-model.number="rawValue"
            type="number"
            min="0"
            step="1"
            class="border border-white/10 rounded bg-surface px-2 py-1 text-white"
          >
        </label>
        <label class="flex flex-col gap-1">
          <span>备注</span>
          <input
            v-model="note"
            class="border border-white/10 rounded bg-surface px-2 py-1 text-white"
          >
        </label>
      </div>
    </div>

    <!-- 目标面板 -->
    <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-xs text-white/60 font-medium">
          目标 <span class="text-white/40">· {{ vms.length }}</span>
        </div>
        <select
          class="min-w-0 flex-1 border border-white/10 rounded bg-surface px-2 py-1 text-xs text-white"
          @change="(event) => { addTarget((event.target as HTMLSelectElement).value); (event.target as HTMLSelectElement).value = '' }"
        >
          <option value="">
            ＋ 添加目标
          </option>
          <option v-for="char in chars.all" :key="char._id" :value="char._id">
            {{ char.name }}
          </option>
        </select>
      </div>

      <TargetQuickPicker
        :selected-ids="vms.map(vm => vm.charId)"
        @toggle="toggleTarget"
      />

      <div v-if="vms.length === 0" class="rounded bg-black/20 py-3 text-center text-xs text-white/40">
        还没有目标
      </div>
      <TargetRow
        v-for="vm in vms"
        :key="vm.charId"
        :char-name="vm.charName"
        :defense-text="vm.defenseText"
        :hit-value-text="resistType !== 'none' && hitValue !== undefined ? `${hitValueLabel} ${hitValue}` : undefined"
        :resist-type="resistType"
        :preview="vm.preview"
        :target="vm.target"
        :can-apply="vm.canApply && firestoreReady && !writing"
        @update:target="updateTarget(vm.charId, $event)"
        @apply="applyOne(vm)"
        @remove="removeTarget(vm.charId)"
      />
    </div>

    <!-- 结果预览 -->
    <ResultSummary
      :kind="kind"
      :damage-type="damageType"
      :resist-type="resistType"
      :actor-name="actor?.name"
      :actor-mp="actorMp ?? undefined"
      :mp-consumed="mpConsumed"
      :raw-value="rawValue"
      :hit-value="hitValue"
      :hit-value-label="hitValueLabel"
      :mp-cost="mpCost"
      :note="note"
      :rows="summaryRows"
    />

    <div v-if="!firestoreReady" class="border border-yellow/20 rounded bg-yellow/10 px-2 py-1 text-xs text-yellow/80">
      等待 ccfolia 加载(SDK 未就绪)…
    </div>
    <div v-else-if="writeError" class="border border-hp/20 rounded bg-hp/10 px-2 py-1 text-xs text-hp/90">
      {{ writeError }}
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="h-9 flex-1 rounded bg-white/10 px-3 text-sm text-white/80 transition-colors disabled:cursor-not-allowed hover:bg-white/15 disabled:opacity-40"
        :disabled="!actorId"
        :title="actorId ? '结束当前角色回合,进入已行动' : '先选一个行动者'"
        @click="endActorTurn"
      >
        结束角色回合
      </button>
      <button
        type="button"
        class="h-9 flex-1 rounded bg-accent/80 px-3 text-sm text-white transition-colors disabled:cursor-not-allowed hover:bg-accent disabled:opacity-40"
        :disabled="!vms.length || !firestoreReady || writing"
        @click="applyAll"
      >
        {{ writing ? '写入中…' : '全部应用' }}
      </button>
    </div>
  </section>
</template>
