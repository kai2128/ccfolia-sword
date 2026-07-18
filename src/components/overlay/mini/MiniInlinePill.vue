<script setup lang="ts">
// E 变体 — 单角色单一 HP / 可选 MP。数值居中一行,下面叠满宽的细 fill 条(StackBar)。
// MP 缺省时数值分隔与 MP 条一起收掉,不留空白。
import { computed } from 'vue'
import { hpTier } from './hp-tier'
import StackBar from './StackBar.vue'

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
const hpText = computed(() => hpTier(hr.value).shine)
</script>

<template>
  <div
    class="inline-flex flex-col items-stretch font-mono"
    :style="{
      gap: '2px',
      padding: '2px 5px',
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
    <!-- 数值行:HP · 分隔 · MP,居中 -->
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

    <!-- fill 条:HP 在上,MP 在下,各占满宽 -->
    <div class="flex flex-col" style="gap: 1px">
      <StackBar :ratio="hr" kind="hp" :danger="lowHp" />
      <StackBar v-if="hasMp" :ratio="mr" kind="mp" />
    </div>
  </div>
</template>
