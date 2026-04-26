<script setup lang="ts">
import type { TickPrompt } from '@/ccfolia/writers/tick-buff-turns'
import { Dialog } from '@/components/ui'

defineProps<{
  prompts: TickPrompt[]
}>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Dialog v-model:open="open" title="本回合 Buff 提示">
    <ul class="m-0 flex flex-col list-none gap-1.5 p-0">
      <li
        v-for="(p, i) in prompts"
        :key="`${p.characterId}-${p.buffId}-${i}`"
        class="border-l-2 border-accent/60 px-2 py-1 text-sm text-white"
      >
        <span class="text-white/60">[{{ p.buffName }}]</span>
        <span class="ml-2">{{ p.prompt }}</span>
      </li>
    </ul>
    <div class="mt-3 flex justify-end">
      <button
        type="button"
        class="h-8 rounded bg-accent/80 px-3 text-sm text-white hover:bg-accent"
        @click="open = false"
      >
        知道了
      </button>
    </div>
  </Dialog>
</template>
