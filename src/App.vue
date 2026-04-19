<script setup lang="ts">
import { computed } from 'vue'
import { useCcfoliaCharacters } from '@/composables/useCcfoliaCharacters'

const { characters, usingFallback } = useCcfoliaCharacters(1000)

// 单/多部位 MVP 只看第一条 status(HP)
function primaryHp(char: { status: { label: string, value: number, max: number }[] }) {
  const hp = char.status.find(s => /hp|ＨＰ/i.test(s.label)) ?? char.status[0]
  return hp ? `${hp.value}/${hp.max}` : '—'
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

    <div v-if="empty" class="text-xs opacity-60">
      未读到角色(打开含角色立绘的房间)
    </div>

    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="char in characters"
        :key="char._id"
        class="w-full flex chip items-center justify-between gap-2 bg-surface/50 text-xs"
      >
        <span class="truncate">{{ char.name }}</span>
        <span class="text-hp font-mono">{{ primaryHp(char) }}</span>
      </li>
    </ul>
  </div>
</template>
