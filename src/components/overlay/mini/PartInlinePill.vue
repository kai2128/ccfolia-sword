<script setup lang="ts">
// 单部位 row。复用 E 的 pill 外壳,前面多一段 part 名(label)。
// hp.cur <= 0 → 整行半透明 + label strikethrough,作为「该部位破坏」的视觉。
// 每个 part 的 mp 可独立缺省;不会影响其它 part 的对齐(各自一个独立 pill)。
import { computed } from 'vue'
import FillPip from './FillPip.vue'

const props = withDefaults(defineProps<{
  label?: string
  hp: { cur: number, max: number }
  mp?: { cur: number, max: number } | null
  showMax?: boolean
}>(), {
  showMax: true,
})

const hr = computed(() => props.hp.max > 0 ? props.hp.cur / props.hp.max : 0)
const broken = computed(() => props.hp.cur <= 0)
const lowHp = computed(() => !broken.value && hr.value <= 0.25)
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
      opacity: broken ? .55 : 1,
    }"
  >
    <span
      v-if="label"
      class="font-serif"
      :style="{
        fontSize: '9px',
        color: broken ? '#8c5e5e' : '#c9bf9b',
        textDecoration: broken ? 'line-through' : 'none',
        letterSpacing: '.05em',
        marginRight: '1px',
      }"
    >{{ label }}</span>
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
