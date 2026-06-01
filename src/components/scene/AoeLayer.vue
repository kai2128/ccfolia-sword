<script setup lang="ts">
// AOE 符文阵层。挂在低 z(z=100,棋子 z=101 之下)的 grid host 里、GridOverlay 之后,
// 于是落在网格之上、角色棋子之下。数据从锚定角色的 ccfolia params 解析(像 buff)。
import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { collectAoeFromParams } from '@/core/range'
import AoeIndicator from './AoeIndicator.vue'

const chars = useRoomCharactersStore()
// 只画 enabled 的;隐藏的留在管理列表里可再显示。
const aoeEntries = computed(() =>
  chars.all.flatMap(c => collectAoeFromParams(c)).filter(a => a.enabled),
)
</script>

<template>
  <div class="pointer-events-none absolute inset-0">
    <AoeIndicator
      v-for="aoe in aoeEntries"
      :key="`aoe-${aoe.id}`"
      :aoe="aoe"
    />
  </div>
</template>
