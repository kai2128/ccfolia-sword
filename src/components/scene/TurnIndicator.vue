<script setup lang="ts">
import { useEncounterStore } from '@/stores/encounter'

const encounter = useEncounterStore()
</script>

<template>
  <div
    v-if="encounter.shared.inCombat"
    class="pointer-events-none absolute right-3 top-3 select-none rounded bg-black/55 px-3 py-1 text-base text-white font-bold"
    style="z-index: 9998;"
  >
    回合 {{ encounter.shared.turn }}
  </div>
</template>
