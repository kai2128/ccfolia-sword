import type { ActionTarget, DamageType, ResistType } from '@/types/action'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface ActionDraftSnapshot {
  kind: 'damage' | 'heal'
  damageType: DamageType
  resistType: ResistType
  rawValue: number
  hitValue: number | undefined
  mpCost: number
  note: string
  targets: ActionTarget[]
  mpConsumed: boolean
}

const STORAGE_KEY = 'ccs:action-draft'

function defaults(): ActionDraftSnapshot {
  return {
    kind: 'damage',
    damageType: 'physical',
    resistType: 'evasion',
    rawValue: 0,
    hitValue: undefined,
    mpCost: 0,
    note: '',
    targets: [],
    mpConsumed: false,
  }
}

function load(): ActionDraftSnapshot {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw)
      return defaults()
    return { ...defaults(), ...(JSON.parse(raw) as Partial<ActionDraftSnapshot>) }
  }
  catch {
    return defaults()
  }
}

function save(snapshot: ActionDraftSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
  catch {
    // sessionStorage 被禁用/写满时静默,不影响结算流程。
  }
}

export const useActionDraftStore = defineStore('action-draft', () => {
  const initial = load()
  const kind = ref<'damage' | 'heal'>(initial.kind)
  const damageType = ref<DamageType>(initial.damageType)
  const resistType = ref<ResistType>(initial.resistType)
  const rawValue = ref(initial.rawValue)
  const hitValue = ref<number | undefined>(initial.hitValue)
  const mpCost = ref(initial.mpCost)
  const note = ref(initial.note)
  const targets = ref<ActionTarget[]>(initial.targets)
  const mpConsumed = ref(initial.mpConsumed)

  // deep watch 所有字段,每次改动落盘一次;tab 切走再回来也不会丢。
  watch(
    [kind, damageType, resistType, rawValue, hitValue, mpCost, note, targets, mpConsumed],
    () => save({
      kind: kind.value,
      damageType: damageType.value,
      resistType: resistType.value,
      rawValue: rawValue.value,
      hitValue: hitValue.value,
      mpCost: mpCost.value,
      note: note.value,
      targets: targets.value,
      mpConsumed: mpConsumed.value,
    }),
    { deep: true },
  )

  function reset(): void {
    const d = defaults()
    kind.value = d.kind
    damageType.value = d.damageType
    resistType.value = d.resistType
    rawValue.value = d.rawValue
    hitValue.value = d.hitValue
    mpCost.value = d.mpCost
    note.value = d.note
    targets.value = d.targets
    mpConsumed.value = d.mpConsumed
  }

  return {
    kind,
    damageType,
    resistType,
    rawValue,
    hitValue,
    mpCost,
    note,
    targets,
    mpConsumed,
    reset,
  }
})
