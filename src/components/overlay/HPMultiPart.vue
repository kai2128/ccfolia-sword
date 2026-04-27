<script setup lang="ts">
// 多部位角色 (boss) 的 HP/MP 指示器 — 一组 part-row 在棋子上方纵向堆叠;
// 每个 part 自带可选 MP,HP/MP 像单部位那样紧贴。不画角色名头(ccfolia 自身已显示)。
import CapsuleBar from './CapsuleBar.vue'

interface PartInput {
  label: string
  cur: number
  max: number
  mp?: { cur: number, max: number } | null
  // main:典型为 "胴",HP 高度多 2px
  main?: boolean
  kind?: 'hp' | 'mp' | 'sp' | 'shield' | 'danger'
  hit?: boolean
}

const props = withDefaults(defineProps<{
  parts: PartInput[]
  width?: number
  // active:当前被攻击的 part 下标,推一下 translateX(2px)。MVP 不接,留 prop 备用。
  active?: number
}>(), {
  width: 220,
})

const labelColW = 24
const rowGap = 6
const innerW = (): number => props.width - (labelColW + rowGap)

function hpHeight(p: PartInput): number {
  return p.main ? 13 : 11
}
</script>

<template>
  <div :style="{ width: `${width}px` }" class="flex flex-col gap-y-1.5">
    <!-- 每个 part:HP 一行 + 可选 MP 一行 (紧贴 HP) -->
    <div
      v-for="(p, i) in parts"
      :key="`${p.label}-${i}`"
      class="flex flex-col"
      :style="{
        opacity: p.cur <= 0 ? 0.35 : 1,
        transform: active === i ? 'translateX(2px)' : 'translateX(0)',
        transition: 'transform var(--t-quick) var(--ease-out)',
      }"
    >
      <!-- HP 行:label + bar。flex row 高度 = bar 高度,line-height: 1 让 label 不撑高 row。 -->
      <div class="flex items-center" :style="{ gap: `${rowGap}px`, height: `${hpHeight(p)}px` }">
        <span
          class="text-right font-serif"
          :style="{
            width: `${labelColW}px`,
            height: `${hpHeight(p)}px`,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            fontSize: '11px',
            fontWeight: 800,
            color: '#000',
            textDecoration: p.cur <= 0 ? 'line-through' : 'none',
            textShadow:
              '-1.5px 0 0 #fff, 1.5px 0 0 #fff, 0 -1.5px 0 #fff, 0 1.5px 0 #fff,'
              + ' -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff',
          }"
        >
          {{ p.label }}
        </span>
        <CapsuleBar
          :kind="p.cur <= 0 ? 'danger' : (p.kind ?? 'hp')"
          :cur="p.cur"
          :max="p.max"
          :width="innerW()"
          :height="hpHeight(p)"
          :hit="p.hit"
          :show-value="true"
          :value-font-px="9"
          label=""
        />
      </div>

      <!-- MP 行:有 mp 才出,row 高 = bar 高,负 margin 紧贴 HP。label 列透明占位仅对齐宽度。 -->
      <div
        v-if="p.mp"
        class="flex items-center"
        :style="{ gap: `${rowGap}px`, marginTop: '-3px', height: '6px' }"
      >
        <span
          :style="{
            width: `${labelColW}px`,
            height: '6px',
            color: 'transparent',
            lineHeight: 1,
          }"
        >·</span>
        <CapsuleBar
          kind="mp"
          :cur="p.mp.cur"
          :max="p.mp.max"
          :width="innerW()"
          :height="6"
          :show-value="true"
          value-anchor="bottom"
          :value-font-px="7"
          label=""
        />
      </div>
    </div>
  </div>
</template>
