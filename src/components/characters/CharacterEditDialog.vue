<script setup lang="ts">
// 新建 / 编辑 StoredCharacter 的对话框。MVP 只支持单部位编辑。
//
// open 用 defineModel;edit prop 传入待编辑的 StoredCharacter 或 undefined(新建模式)。
// 保存时:denormalize + upsert;id 冲突 = 编辑更新。
import type { StoredCharacter } from '@/types/character'
import { computed, ref, watch } from 'vue'
import { Button, Dialog, Field, Input, Select } from '@/components/ui'
import { useCcfoliaCharacters } from '@/composables/useCcfoliaCharacters'
import { useCharactersStore } from '@/stores/characters'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  edit?: StoredCharacter
}>()

const store = useCharactersStore()
const { characters: ccfoliaList } = useCcfoliaCharacters()

// 本地可编辑副本 —— 保存前不动 store。
interface Draft {
  id: string
  name: string
  nickname: string
  faction: 'friendly' | 'enemy' | 'neutral'
  control: 'pc' | 'gm'
  memo: string
  ccfoliaCharacterId: string
  hpCurrent: number
  hpMax: number
  mpCurrent: number
  mpMax: number
  ab: { dex: number, agi: number, str: number, vit: number, int: number, will: number }
  combat: { evasion: number, lifeResistance: number, mentalResistance: number, armor: number }
  defaultInitiative: number
  isMultiPart: boolean
}

function blankDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    name: '',
    nickname: '',
    faction: 'friendly',
    control: 'pc',
    memo: '',
    ccfoliaCharacterId: '',
    hpCurrent: 0,
    hpMax: 0,
    mpCurrent: 0,
    mpMax: 0,
    ab: { dex: 0, agi: 0, str: 0, vit: 0, int: 0, will: 0 },
    combat: { evasion: 0, lifeResistance: 0, mentalResistance: 0, armor: 0 },
    defaultInitiative: 0,
    isMultiPart: false,
  }
}

const draft = ref<Draft>(blankDraft())
const errors = ref<{ name?: string }>({})

function loadFrom(c: StoredCharacter) {
  const multi = Array.isArray(c.parts) && c.parts.length > 0
  draft.value = {
    id: c.id,
    name: c.name,
    nickname: c.nickname ?? '',
    faction: c.faction,
    control: c.control,
    memo: c.memo ?? '',
    ccfoliaCharacterId: c.ccfoliaCharacterId ?? '',
    hpCurrent: c.hp?.current ?? 0,
    hpMax: c.hp?.max ?? 0,
    mpCurrent: c.mp?.current ?? 0,
    mpMax: c.mp?.max ?? 0,
    ab: {
      dex: c.abilities?.dexterity.value ?? 0,
      agi: c.abilities?.agility.value ?? 0,
      str: c.abilities?.strength.value ?? 0,
      vit: c.abilities?.vitality.value ?? 0,
      int: c.abilities?.intelligence.value ?? 0,
      will: c.abilities?.will.value ?? 0,
    },
    combat: {
      evasion: c.combat?.evasion ?? 0,
      lifeResistance: c.combat?.lifeResistance ?? 0,
      mentalResistance: c.combat?.mentalResistance ?? 0,
      armor: c.combat?.armor ?? 0,
    },
    defaultInitiative: c.defaultInitiative ?? 0,
    isMultiPart: multi,
  }
}

// 每次打开 / edit 变化时重置 draft
watch([() => open.value, () => props.edit], ([o, e]) => {
  if (!o)
    return
  if (e)
    loadFrom(e)
  else
    draft.value = blankDraft()
  errors.value = {}
}, { immediate: true })

const factionOptions = [
  { value: 'friendly', label: '友方' },
  { value: 'enemy', label: '敌方' },
  { value: 'neutral', label: '中立' },
]

const controlOptions = [
  { value: 'pc', label: 'PC(玩家)' },
  { value: 'gm', label: 'GM(NPC/怪)' },
]

const ccfoliaOptions = computed(() => [
  { value: '', label: '未绑定' },
  ...ccfoliaList.value.map(c => ({ value: c._id, label: c.name })),
])

function abilityPair(v: number) {
  return { value: v, bonus: Math.floor(v / 6) }
}

function buildStored(): StoredCharacter {
  const d = draft.value
  // 多部位模式下保留原 parts 不动,其他字段更新
  if (d.isMultiPart && props.edit?.parts) {
    return {
      ...props.edit,
      id: d.id,
      name: d.name,
      nickname: d.nickname || undefined,
      faction: d.faction,
      control: d.control,
      memo: d.memo || undefined,
      ccfoliaCharacterId: d.ccfoliaCharacterId || undefined,
    }
  }
  return {
    id: d.id,
    ccfoliaCharacterId: d.ccfoliaCharacterId || undefined,
    name: d.name,
    nickname: d.nickname || undefined,
    faction: d.faction,
    control: d.control,
    memo: d.memo || undefined,
    classes: props.edit?.classes ?? [],
    skills: props.edit?.skills ?? [],
    equipment: props.edit?.equipment ?? { weapons: [], accessories: [] },
    inventory: props.edit?.inventory ?? [],
    palette: props.edit?.palette ?? [],
    hp: { current: d.hpCurrent, max: d.hpMax },
    mp: { current: d.mpCurrent, max: d.mpMax },
    abilities: {
      dexterity: abilityPair(d.ab.dex),
      agility: abilityPair(d.ab.agi),
      strength: abilityPair(d.ab.str),
      vitality: abilityPair(d.ab.vit),
      intelligence: abilityPair(d.ab.int),
      will: abilityPair(d.ab.will),
    },
    combat: { ...d.combat },
    defaultInitiative: d.defaultInitiative,
  }
}

function onSave() {
  if (!draft.value.name.trim()) {
    errors.value.name = '必填'
    return
  }
  store.upsert(buildStored())
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open" :title="edit ? '编辑角色' : '新建角色'">
    <div class="max-h-[60vh] flex flex-col gap-3 overflow-auto pr-1">
      <Field label="名字" :error="errors.name">
        <template #default="{ id }">
          <Input :id="id" v-model="draft.name" placeholder="格伦" />
        </template>
      </Field>

      <Field label="昵称(可选)">
        <template #default="{ id }">
          <Input :id="id" v-model="draft.nickname" placeholder="队长" />
        </template>
      </Field>

      <div class="grid grid-cols-2 gap-2">
        <Field label="阵营">
          <Select v-model="draft.faction" :options="factionOptions" />
        </Field>
        <Field label="控制方">
          <Select v-model="draft.control" :options="controlOptions" />
        </Field>
      </div>

      <Field label="绑定 ccfolia 立绘" hint="可选,导入立绘后在下拉里出现">
        <Select v-model="draft.ccfoliaCharacterId" :options="ccfoliaOptions" placeholder="未绑定" />
      </Field>

      <div v-if="draft.isMultiPart" class="rounded bg-buff/10 p-2 text-xs text-buff">
        多部位角色数值暂不支持 UI 编辑,请用 JSON 导入修改 parts。
      </div>

      <template v-else>
        <div class="mt-1 text-xs text-white/60 font-medium">HP / MP</div>
        <div class="grid grid-cols-4 gap-2">
          <Field label="HP 当前">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.hpCurrent" type="number" min="0" />
            </template>
          </Field>
          <Field label="HP 上限">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.hpMax" type="number" min="0" />
            </template>
          </Field>
          <Field label="MP 当前">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.mpCurrent" type="number" min="0" />
            </template>
          </Field>
          <Field label="MP 上限">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.mpMax" type="number" min="0" />
            </template>
          </Field>
        </div>

        <div class="mt-1 text-xs text-white/60 font-medium">六围(bonus 自动 = floor(value/6))</div>
        <div class="grid grid-cols-3 gap-2">
          <Field label="器用">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.ab.dex" type="number" min="0" />
            </template>
          </Field>
          <Field label="敏捷">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.ab.agi" type="number" min="0" />
            </template>
          </Field>
          <Field label="筋力">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.ab.str" type="number" min="0" />
            </template>
          </Field>
          <Field label="生命">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.ab.vit" type="number" min="0" />
            </template>
          </Field>
          <Field label="知力">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.ab.int" type="number" min="0" />
            </template>
          </Field>
          <Field label="精神">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.ab.will" type="number" min="0" />
            </template>
          </Field>
        </div>

        <div class="mt-1 text-xs text-white/60 font-medium">战斗数值</div>
        <div class="grid grid-cols-4 gap-2">
          <Field label="回避">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.combat.evasion" type="number" />
            </template>
          </Field>
          <Field label="生命抗">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.combat.lifeResistance" type="number" />
            </template>
          </Field>
          <Field label="精神抗">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.combat.mentalResistance" type="number" />
            </template>
          </Field>
          <Field label="护甲">
            <template #default="{ id }">
              <Input :id="id" v-model.number="draft.combat.armor" type="number" />
            </template>
          </Field>
        </div>

        <Field label="默认先攻" hint="用于战斗开始时的排序">
          <template #default="{ id }">
            <Input :id="id" v-model.number="draft.defaultInitiative" type="number" />
          </template>
        </Field>
      </template>
    </div>

    <div class="mt-2 flex justify-end gap-2">
      <Button variant="ghost" size="sm" @click="open = false">取消</Button>
      <Button size="sm" @click="onSave">保存</Button>
    </div>
  </Dialog>
</template>
