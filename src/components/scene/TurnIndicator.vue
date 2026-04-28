<script setup lang="ts">
import { useEncounterStore } from '@/stores/encounter'

const encounter = useEncounterStore()
</script>

<template>
  <!-- 回合指示器:左右银渐变水平线 + 居中"回合 X",font-serif 同 capsule 系列。 -->
  <div
    v-if="encounter.shared.inCombat"
    class="pointer-events-none fixed flex select-none items-center gap-4 font-serif"
    style="bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 99999; min-width: 260px;"
  >
    <span
      style="height: 2px; flex: 1; background: linear-gradient(90deg, transparent, var(--cap-rim-top));"
    />
    <span
      :style="{
        fontSize: '20px',
        fontWeight: 700,
        letterSpacing: '.24em',
        color: '#fff7e0',
        textShadow:
          '0 0 8px rgba(255, 209, 102, 0.55),'
          + ' 0 2px 3px rgba(0, 0, 0, 0.95),'
          + ' 0 0 2px #000',
        whiteSpace: 'nowrap',
      }"
    >
      回合 {{ encounter.shared.turn }}
    </span>
    <span
      style="height: 2px; flex: 1; background: linear-gradient(90deg, var(--cap-rim-top), transparent);"
    />
  </div>
</template>
