<script setup lang="ts">
import { useEncounterStore } from '@/stores/encounter'

const encounter = useEncounterStore()
</script>

<template>
  <div
    v-if="encounter.shared.inCombat"
    class="pointer-events-none fixed right-3 select-none rounded bg-black/55 px-3 py-1 text-base text-white font-bold"
    style="top: 0; z-index: 99999; right: 50vw;"
  >
    回合 {{ encounter.shared.turn }}
  </div>
</template>
