<script setup lang="ts">
// 角色库 Tab 容器。组合 Toolbar / List / EditDialog。
// 状态条用一个自动消失的提示(复用 BattleTab 的 5 秒模式)。
import type { StoredCharacter } from '@/types/character'
import { computed, ref } from 'vue'
import CharacterEditDialog from '@/components/characters/CharacterEditDialog.vue'
import CharacterList from '@/components/characters/CharacterList.vue'
import CharacterToolbar from '@/components/characters/CharacterToolbar.vue'
import { useCharactersStore } from '@/stores/characters'

const store = useCharactersStore()

const dialogOpen = ref(false)
const editing = ref<StoredCharacter | undefined>(undefined)

function openNew() {
  editing.value = undefined
  dialogOpen.value = true
}

function openEdit(id: string) {
  editing.value = store.byId(id)
  dialogOpen.value = true
}

function onRemove(id: string) {
  store.remove(id)
}

// 状态条
const status = ref<{ msg: string, kind: 'ok' | 'err' } | null>(null)
let statusTimer: number | null = null

function pushStatus(msg: string, kind: 'ok' | 'err') {
  status.value = { msg, kind }
  if (statusTimer !== null)
    window.clearTimeout(statusTimer)
  statusTimer = window.setTimeout(() => {
    status.value = null
    statusTimer = null
  }, 5000)
}

const empty = computed(() => store.all.length === 0)
</script>

<template>
  <div class="flex flex-col gap-2">
    <CharacterToolbar
      @new="openNew"
      @status="(msg, kind) => pushStatus(msg, kind)"
    />

    <div v-if="status" class="text-xs" :class="status.kind === 'ok' ? 'text-buff' : 'text-debuff'">
      {{ status.msg }}
    </div>

    <div v-if="empty" class="rounded border border-white/10 p-3 text-xs text-white/60">
      角色库为空。点上面的「样例」一键插入格伦 / 哥布林 / 火龙,或用「导入」加载 JSON,或「新建」。
    </div>

    <CharacterList
      v-else
      :items="store.asRuntimeList"
      @edit="openEdit"
      @remove="onRemove"
    />

    <CharacterEditDialog v-model:open="dialogOpen" :edit="editing" />
  </div>
</template>
