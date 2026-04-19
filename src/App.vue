<script setup lang="ts">
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed, ref } from 'vue'
import { adjustStatusValue } from '@/ccfolia/firestore-writer'
import { useCcfoliaCharacters } from '@/composables/useCcfoliaCharacters'
import { useFirestoreReady } from '@/composables/useFirestoreReady'

const { characters, usingFallback } = useCcfoliaCharacters(1000)
const { ready: sessionReady } = useFirestoreReady()

// 单/多部位 MVP 只看第一条 status(HP)
function primaryHp(char: CcfoliaCharacter) {
  const hp = char.status.find(s => /hp|ＨＰ/i.test(s.label)) ?? char.status[0]
  return hp ? `${hp.value}/${hp.max}` : '—'
}

function primaryHpIndex(char: CcfoliaCharacter) {
  const idx = char.status.findIndex(s => /hp|ＨＰ/i.test(s.label))
  return idx >= 0 ? idx : 0
}

const busyId = ref<string | null>(null)
const lastError = ref<string | null>(null)

async function onDamage(char: CcfoliaCharacter) {
  if (!sessionReady.value || busyId.value)
    return
  busyId.value = char._id
  lastError.value = null
  try {
    await adjustStatusValue(char, primaryHpIndex(char), -1)
  }
  catch (e) {
    lastError.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    busyId.value = null
  }
}

const empty = computed(() => characters.value.length === 0)
</script>

<template>
  <div class="fixed bottom-4 right-4 max-h-80 w-72 flex flex-col gap-2 overflow-auto card">
    <div class="flex items-center gap-2">
      <div class="i-lucide-sword text-5 text-hp" />
      <span class="text-sm font-medium">ccfolia-sword</span>
      <span class="ml-auto text-xs opacity-60">
        M1 · {{ characters.length }}
        <span v-if="usingFallback" class="text-buff">(fallback)</span>
      </span>
    </div>

    <div v-if="!sessionReady" class="text-xs text-buff">
      等待 Firebase SDK 挂钩…
    </div>

    <div v-if="empty" class="text-xs opacity-60">
      未读到角色(打开含角色立绘的房间)
    </div>

    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="char in characters"
        :key="char._id"
        class="w-full flex chip items-center gap-2 bg-surface/50 text-xs"
      >
        <span class="flex-1 truncate">{{ char.name }}</span>
        <span class="text-hp font-mono">{{ primaryHp(char) }}</span>
        <button
          class="rounded bg-debuff/20 px-1.5 py-0.5 text-debuff font-mono disabled:opacity-30"
          :disabled="!sessionReady || busyId === char._id"
          :title="sessionReady ? 'HP -1' : '等 Firebase SDK'"
          @click="onDamage(char)"
        >
          -1
        </button>
      </li>
    </ul>

    <div v-if="lastError" class="text-xs text-debuff">
      {{ lastError }}
    </div>
  </div>
</template>
