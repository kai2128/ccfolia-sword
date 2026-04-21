<script setup lang="ts">
import type { StatusChange } from '@/ccfolia/writers/apply-action-batch'
import type { ActionDraft, ActionTarget, DamageType, ResistType } from '@/types/action'
import { computed, ref, watch } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { applyStatusChangesBatch } from '@/ccfolia/writers/apply-action-batch'
import { useFirestoreReady } from '@/composables/useFirestoreReady'
import { applyDamageToTarget, validateDraft } from '@/core/combat/apply-damage'
import { applyHealToTarget } from '@/core/combat/apply-heal'
import { resolveDefense } from '@/core/combat/resolve-modifiers'
import { readStatusSlot } from '@/core/status-slot'
import { useSettingsStore } from '@/stores/settings'
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
}

const settings = useSettingsStore()
const chars = useRoomCharactersStore()
const { ready: firestoreReady } = useFirestoreReady()

const kind = ref<'damage' | 'heal'>('damage')
const damageType = ref<DamageType>('physical')
const resistType = ref<ResistType>('none')
const rawValue = ref(0)
const mpCost = ref(0)
const note = ref('')
const targets = ref<ActionTarget[]>([])
const writing = ref(false)
const writeError = ref('')
const mpConsumed = ref(false)

watch(kind, (value) => {
  if (value === 'heal')
    resistType.value = 'none'
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
    }
  }

  const defenseText = kind.value === 'damage' && damageType.value === 'physical'
    ? `防御 ${resolveDefense(char.status, settings.statusLabelMap, [])}`
    : undefined

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
      }
    }

    const result = applyDamageToTarget(
      draft.value,
      target,
      { status: char.status, mods: [], currentHp: hp.value },
      settings.statusLabelMap,
    )

    return {
      charId: target.characterId,
      charName: char.name,
      defenseText,
      preview: String(result.finalDamage),
      canApply: draft.value.resistType === 'none' || !!target.resistResult,
      target,
      newHp: result.newHp,
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
    }
  }
}

const vms = computed<TargetRowVm[]>(() => targets.value.map(buildPreviewVm))

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

  const actor = chars.byId(props.actorId)
  if (!actor)
    return null

  const mp = readStatusSlot(actor.status, 'mp', settings.statusLabelMap)
  if (!mp)
    return null

  return {
    char: actor,
    slot: 'mp',
    newValue: Math.max(0, mp.value - mpCost.value),
  }
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
  try {
    validateDraft(draft.value)
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
      targets.value = []
    },
  )
}
</script>

<template>
  <section class="flex flex-col gap-3 border border-white/10 rounded-md bg-white/3 p-3">
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
      </template>
    </div>

    <div class="grid grid-cols-3 gap-2 text-xs text-white/80">
      <label class="flex flex-col gap-1">
        <span>原值</span>
        <input
          v-model.number="rawValue"
          type="number"
          min="0"
          step="1"
          class="border border-white/10 rounded bg-surface px-2 py-1 text-white"
        >
      </label>
      <label class="flex flex-col gap-1">
        <span>MP</span>
        <input
          v-model.number="mpCost"
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

    <div class="flex items-center gap-2">
      <select
        class="min-w-0 flex-1 border border-white/10 rounded bg-surface px-2 py-1 text-sm text-white"
        @change="(event) => { addTarget((event.target as HTMLSelectElement).value); (event.target as HTMLSelectElement).value = '' }"
      >
        <option value="">
          ＋ 添加目标
        </option>
        <option v-for="char in chars.all" :key="char._id" :value="char._id">
          {{ char.name }}
        </option>
      </select>
      <span class="text-xs text-white/40">
        {{ vms.length }} 目标
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <TargetRow
        v-for="vm in vms"
        :key="vm.charId"
        :char-name="vm.charName"
        :defense-text="vm.defenseText"
        :resist-type="resistType"
        :preview="vm.preview"
        :target="vm.target"
        :can-apply="vm.canApply && firestoreReady && !writing"
        @update:target="updateTarget(vm.charId, $event)"
        @apply="applyOne(vm)"
      />
    </div>

    <div v-if="!firestoreReady" class="border border-yellow/20 rounded bg-yellow/10 px-2 py-1 text-xs text-yellow/80">
      等待 ccfolia 加载(SDK 未就绪)…
    </div>
    <div v-else-if="writeError" class="border border-hp/20 rounded bg-hp/10 px-2 py-1 text-xs text-hp/90">
      {{ writeError }}
    </div>

    <div class="flex justify-end">
      <button
        type="button"
        class="h-8 rounded bg-accent/80 px-3 text-sm text-white transition-colors disabled:cursor-not-allowed hover:bg-accent disabled:opacity-40"
        :disabled="!vms.length || !firestoreReady || writing"
        @click="applyAll"
      >
        {{ writing ? '写入中…' : '全部应用' }}
      </button>
    </div>
  </section>
</template>
