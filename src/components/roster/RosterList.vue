<script setup lang="ts">
import type { StatusSlot } from '@/core/status-slot'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import RosterRow from '@/components/roster/RosterRow.vue'
import { useSettingsStore } from '@/stores/settings'

const chars = useRoomCharactersStore()
const settings = useSettingsStore()

async function onChange(charId: string, slot: StatusSlot, newValue: number) {
  const char = chars.byId(charId)
  if (!char)
    return
  try {
    await writeStatusValue({ char, slot, newValue, labelMap: settings.statusLabelMap })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
}
</script>

<template>
  <ul class="roster-list">
    <RosterRow
      v-for="char in chars.all"
      :key="char._id"
      :char="char"
      :label-map="settings.statusLabelMap"
      @change="(slot, v) => onChange(char._id, slot, v)"
    />
    <li v-if="chars.all.length === 0" class="empty">
      房间内没有角色
    </li>
  </ul>
</template>

<style scoped>
.roster-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.empty {
  padding: 8px 0;
  font-size: 12px;
  opacity: 0.6;
}
</style>
