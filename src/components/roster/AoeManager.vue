<script setup lang="ts">
import type { AoeIndicator } from '@/core/range'
import { computed, reactive, ref } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { clearCharacterAoe } from '@/ccfolia/writers/clear-character-aoe'
import { removeCharacterAoe } from '@/ccfolia/writers/remove-character-aoe'
import { setCharacterAoe } from '@/ccfolia/writers/set-character-aoe'
import { Input, PopConfirm } from '@/components/ui'
import { AOE_PRESETS, collectAoeFromParams } from '@/core/range'
import { uuid } from '@/infra/uuid'

const props = defineProps<{ characterId: string }>()

const chars = useRoomCharactersStore()

// 本角色当前已挂的 AOE 指示器(从该角色 ccfolia params 解析)
const aoeList = computed<AoeIndicator[]>(() => {
  const char = chars.byId(props.characterId)
  return char ? collectAoeFromParams(char) : []
})

// 自定义表单:turns 空字符串 = 永久。
const form = reactive({ label: '领域', radiusM: 3, color: '#cf8533', turns: '' as string })

// 输入框可能给到 string 或 number,统一成字符串再判定;空/非法/<=0 → 永久(null)。
function normTurns(v: string | number): number | null {
  const s = String(v ?? '').trim()
  const n = Number(s)
  return s === '' || !Number.isFinite(n) || n <= 0 ? null : Math.floor(n)
}

function addPreset(p: typeof AOE_PRESETS[number]) {
  setCharacterAoe(props.characterId, {
    id: uuid(),
    label: p.label,
    radiusM: p.radiusM,
    color: p.color,
    turnsRemaining: null,
    enabled: true,
  })
}

function addCustom() {
  setCharacterAoe(props.characterId, {
    id: uuid(),
    label: form.label || '领域',
    radiusM: Math.max(1, Math.floor(Number(form.radiusM) || 1)),
    color: form.color,
    turnsRemaining: normTurns(form.turns),
    enabled: true,
  })
}

// 内联编辑:点铅笔展开,turns 用字符串(空=永久)。
const editingId = ref<string | null>(null)
const edit = reactive({ label: '', radiusM: 3, color: '#cf8533', turns: '' as string })

function remove(id: string) {
  if (editingId.value === id)
    editingId.value = null
  removeCharacterAoe(props.characterId, id)
}

// 编辑时保留当前显隐状态。
const editEnabled = ref(true)

function startEdit(a: AoeIndicator) {
  editingId.value = a.id
  edit.label = a.label
  edit.radiusM = a.radiusM
  edit.color = a.color
  edit.turns = a.turnsRemaining != null ? String(a.turnsRemaining) : ''
  editEnabled.value = a.enabled
}

function saveEdit(id: string) {
  setCharacterAoe(props.characterId, {
    id,
    label: edit.label || '领域',
    radiusM: Math.max(1, Math.floor(Number(edit.radiusM) || 1)),
    color: edit.color,
    turnsRemaining: normTurns(edit.turns),
    enabled: editEnabled.value,
  })
  editingId.value = null
}

// 显隐切换:整体走 upsert 写回(像 buff 的启用/禁用)。
function toggleEnabled(a: AoeIndicator) {
  const { characterId: _c, ...stored } = a
  setCharacterAoe(props.characterId, { ...stored, enabled: !a.enabled })
}

function clearAll() {
  editingId.value = null
  clearCharacterAoe(props.characterId)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <span class="text-[11px] text-white/50">添加 AOE 领域</span>
      <PopConfirm
        v-if="aoeList.length > 0"
        :message="`清空该角色全部 AOE 领域(${aoeList.length} 个)?`"
        confirm-text="清空"
        @confirm="clearAll"
      >
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-[11px] text-white/40 hover:bg-debuff/20 hover:text-debuff"
          title="清空全部 AOE 领域"
        >
          清空
        </button>
      </PopConfirm>
    </div>

    <div class="flex flex-wrap gap-1">
      <button
        v-for="p in AOE_PRESETS"
        :key="p.key"
        type="button"
        class="flex items-center gap-1 border rounded px-1.5 py-1 text-[11px] hover:bg-white/10"
        :style="{ borderColor: p.color, color: p.color }"
        @click="addPreset(p)"
      >
        {{ p.label }} {{ p.radiusM }}m
      </button>
    </div>

    <div class="my-0.5 h-px bg-white/10" />

    <div class="text-[11px] text-white/50">
      自定义
    </div>
    <div class="flex flex-col gap-1">
      <Input v-model="form.label" placeholder="名称" class="h-6 text-xs" />
      <div class="flex items-end gap-1">
        <label class="flex flex-1 flex-col gap-px text-[9px] text-white/45">
          范围 m
          <input
            v-model.number="form.radiusM"
            type="number" min="1"
            class="h-6 w-full border border-white/20 rounded bg-black/40 px-1 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
        </label>
        <label class="flex flex-1 flex-col gap-px text-[9px] text-white/45">
          回合
          <input
            v-model="form.turns"
            type="number" min="1" placeholder="永久"
            class="h-6 w-full border border-white/20 rounded bg-black/40 px-1 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
        </label>
        <label class="flex flex-col gap-px text-[9px] text-white/45">
          色
          <input
            v-model="form.color"
            type="color"
            class="h-6 w-8 border border-white/20 rounded bg-transparent"
          >
        </label>
      </div>
      <button
        type="button"
        class="rounded bg-accent/80 px-2 py-1 text-xs text-white hover:bg-accent"
        @click="addCustom"
      >
        + 添加
      </button>
    </div>

    <template v-if="aoeList.length > 0">
      <div class="my-0.5 h-px bg-white/10" />
      <div class="text-[11px] text-white/50">
        已挂领域
      </div>
      <div v-for="a in aoeList" :key="a.id" class="flex flex-col gap-1">
        <div
          class="flex items-center justify-between gap-1 rounded px-1 py-0.5 text-[11px]"
          :class="{ 'line-through opacity-50': !a.enabled }"
        >
          <span class="flex items-center gap-1 truncate" :style="{ color: a.color }">
            <span class="inline-block h-2 w-2 rounded-full" :style="{ background: a.color }" />
            {{ a.label }} {{ a.radiusM }}m{{ a.turnsRemaining != null ? ` · ${a.turnsRemaining}T` : '' }}
          </span>
          <span class="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              class="h-4 w-4 flex items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
              :title="a.enabled ? '隐藏(场景上不画)' : '显示'"
              @click="toggleEnabled(a)"
            >
              <span :class="a.enabled ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="text-3" />
            </button>
            <button
              type="button"
              class="h-4 w-4 flex items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
              title="编辑"
              @click="editingId === a.id ? (editingId = null) : startEdit(a)"
            >
              <span class="i-lucide-pencil text-3" />
            </button>
            <button
              type="button"
              class="h-4 w-4 flex items-center justify-center rounded text-white/40 hover:bg-debuff/20 hover:text-debuff"
              title="移除"
              @click="remove(a.id)"
            >
              <span class="i-lucide-x text-3" />
            </button>
          </span>
        </div>

        <!-- 内联编辑器 -->
        <div v-if="editingId === a.id" class="flex flex-col gap-1 rounded bg-black/30 p-1">
          <Input v-model="edit.label" placeholder="名称" class="h-6 text-xs" />
          <div class="flex items-end gap-1">
            <label class="flex flex-1 flex-col gap-px text-[9px] text-white/45">
              范围 m
              <input
                v-model.number="edit.radiusM"
                type="number" min="1"
                class="h-6 w-full border border-white/20 rounded bg-black/40 px-1 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
              >
            </label>
            <label class="flex flex-1 flex-col gap-px text-[9px] text-white/45">
              回合
              <input
                v-model="edit.turns"
                type="number" min="1" placeholder="永久"
                class="h-6 w-full border border-white/20 rounded bg-black/40 px-1 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
              >
            </label>
            <label class="flex flex-col gap-px text-[9px] text-white/45">
              色
              <input
                v-model="edit.color"
                type="color"
                class="h-6 w-8 border border-white/20 rounded bg-transparent"
              >
            </label>
          </div>
          <button
            type="button"
            class="rounded bg-accent/80 px-2 py-1 text-xs text-white hover:bg-accent"
            @click="saveEdit(a.id)"
          >
            保存
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
