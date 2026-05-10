<script setup lang="ts">
// E 变体 — 单角色单一 HP / 可选 MP,一行 pill。
// HP pip + cur/max │ MP pip + cur/max。MP 缺省时整组(分隔+pip+数字)收掉,不留空白。
import { computed } from 'vue'
import FillPip from './FillPip.vue'

const props = withDefaults(defineProps<{
  hp: { cur: number, max: number }
  mp?: { cur: number, max: number } | null
  showMax?: boolean
}>(), {
  showMax: true,
})

const hr = computed(() => props.hp.max > 0 ? props.hp.cur / props.hp.max : 0)
const lowHp = computed(() => hr.value <= 0.25)
const hasMp = computed(() => !!(props.mp && props.mp.max > 0))
const mr = computed(() => hasMp.value ? props.mp!.cur / props.mp!.max : 0)
</script>

<template>
  <div
    class="inline-flex items-center font-mono"
    :style="{
      gap: '3px',
      padding: '1px 5px',
      background: 'rgba(6,9,26,.85)',
      border: '.5px solid rgba(207,214,225,.45)',
      borderRadius: '7px',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '-.02em',
      lineHeight: 1,
      color: '#f4ecd5',
      textShadow: '0 1px 1px #000',
      boxShadow: '0 1px 2px rgba(0,0,0,.6)',
      whiteSpace: 'nowrap',
    }"
  >
    <FillPip :ratio="hr" kind="hp" :danger="lowHp" />
    <span :style="{ color: lowHp ? '#ffb3b3' : '#b8f5c8' }">
      {{ hp.cur }}<span v-if="showMax" style="opacity: .5">/{{ hp.max }}</span>
    </span>
    <template v-if="hasMp">
      <span :style="{ width: '1px', height: '7px', background: 'rgba(207,214,225,.3)' }" />
      <FillPip :ratio="mr" kind="mp" />
      <span style="color: #b8d8ff">
        {{ mp!.cur }}<span v-if="showMax" style="opacity: .5">/{{ mp!.max }}</span>
      </span>
    </template>
  </div>
</template>
