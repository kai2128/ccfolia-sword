<script setup lang="ts">
import { useEncounterStore } from '@/stores/encounter'

const encounter = useEncounterStore()
</script>

<template>
  <div
    v-if="encounter.shared.inCombat"
    class="pointer-events-none fixed right-3 select-none rounded bg-black/55 px-3 py-1 text-base text-white font-bold"
    style="top: 25vh; z-index: 99999;"
  >
    回合 {{ encounter.shared.turn }}
  </div>
</template>
