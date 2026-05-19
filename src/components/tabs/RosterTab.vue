<script setup lang="ts">
import RosterFilterBar from '@/components/roster/RosterFilterBar.vue'
import RosterList from '@/components/roster/RosterList.vue'
</script>

<template>
  <div class="min-h-0 flex flex-1 flex-col gap-2">
    <RosterFilterBar class="shrink-0" />
    <div class="min-h-0 flex-1 overflow-auto">
      <RosterList />
    </div>
  </div>
</template>
