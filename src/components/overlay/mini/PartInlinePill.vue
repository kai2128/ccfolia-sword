<script setup lang="ts">
// 单部位 row。label 在左,右侧一列:数值居中一行 + 满宽 fill 条(HP / 可选 MP)。
// hp.cur <= 0 → 整行半透明 + label strikethrough,作为「该部位破坏」的视觉。
// 每个 part 的 mp 可独立缺省;不会影响其它 part 的对齐(各自一个独立 pill)。
import { computed } from 'vue'
import { hpTier } from './hp-tier'
import StackBar from './StackBar.vue'

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
const hpText = computed(() => hpTier(hr.value, broken.value).shine)
</script>

<template>
  <div
    class="inline-flex items-center font-mono"
    :style="{
      gap: '3px',
      padding: '1px 5px',
      background: 'rgba(6,9,26,.85)',
      border: '.5px solid rgba(207,214,225,.45)',
      borderRadius: '6px',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '-.02em',
      lineHeight: 1,
      color: '#f4ecd5',
      textShadow: '0 1px 1px #000',
      boxShadow: '0 1px 2px rgba(0,0,0,.6)',
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
      }"
    >{{ label }}</span>

    <!-- 数值行(居中) + fill 条列 -->
    <div class="flex flex-col items-stretch" :style="{ flex: 1, minWidth: '40px' }">
      <div class="inline-flex items-center justify-center" style="gap: 3px">
        <span :style="{ color: hpText }">
          {{ hp.cur }}<span v-if="showMax" style="opacity: .5">/{{ hp.max }}</span>
        </span>
        <template v-if="hasMp">
          <span :style="{ width: '1px', height: '7px', background: 'rgba(207,214,225,.3)' }" />
          <span style="color: #b8d8ff">
            {{ mp!.cur }}<span v-if="showMax" style="opacity: .5">/{{ mp!.max }}</span>
          </span>
        </template>
      </div>
      <div class="flex flex-col">
        <StackBar :ratio="hr" kind="hp" :danger="lowHp" :height="2" />
        <div v-if="hasMp" style="width: 88%">
          <StackBar :ratio="mr" kind="mp" :height="2" />
        </div>
      </div>
    </div>
  </div>
</template>
