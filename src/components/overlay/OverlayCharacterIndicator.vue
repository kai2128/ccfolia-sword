<script setup lang="ts">
// 单个角色 (棋子下方) 的 HP/MP 紧凑指示器装配器。
//   单部位 + 决策 = C → MiniDiamondBar
//   单部位 + 决策 = E → MiniInlinePill
//   多部位 + 决策 = E → CharacterParts(variant='E',PartInlinePill 堆叠)
//   多部位 + 决策 = C → CharacterParts(variant='C',MiniDiamondBar 堆叠)
//
// 受击 shake:本组件统一维护 partKey → 是否抖动 的 map,watch 到某 part HP 下降即打 280ms。
// shake class 套在最外层 wrapper(.fx-shake),CSS 关键帧在 src/styles/tokens.css。
// 单部位时整个 wrapper 抖;多部位时也整体抖(目前 CharacterParts 不支持 per-row,
// 后续若需要 per-part 抖,再让 CharacterParts 接受 hit map 透传)。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CharacterParts from './mini/CharacterParts.vue'
import MiniDiamondBar from './mini/MiniDiamondBar.vue'
import MiniInlinePill from './mini/MiniInlinePill.vue'

interface PartInput {
  key: string
  label: string
  isMain: boolean
  hp: { value: number, max: number } | null
  mp: { value: number, max: number } | null
}

const props = defineProps<{
  parts: PartInput[]
  displayMode: 'C' | 'E'
}>()

const hitAny = ref(false)
let hitTimer: ReturnType<typeof setTimeout> | null = null
const lastHpByKey = new Map<string, number>()

watch(
  () => props.parts.map(p => ({ key: p.key, cur: p.hp?.value ?? 0 })),
  (next) => {
    let dropped = false
    for (const { key, cur } of next) {
      const prev = lastHpByKey.get(key)
      if (prev != null && cur < prev) {
        dropped = true
        break
      }
    }
    for (const { key, cur } of next)
      lastHpByKey.set(key, cur)
    if (!dropped)
      return
    if (hitTimer)
      clearTimeout(hitTimer)
    hitAny.value = false
    void Promise.resolve().then(() => {
      hitAny.value = true
      hitTimer = setTimeout(() => {
        hitAny.value = false
      }, 280)
    })
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  if (hitTimer)
    clearTimeout(hitTimer)
})

const isMulti = computed(() => props.parts.length > 1)

const single = computed(() => props.parts[0] ?? null)
const singleHp = computed(() => single.value?.hp ? { cur: single.value.hp.value, max: single.value.hp.max } : null)
const singleMp = computed(() => single.value?.mp ? { cur: single.value.mp.value, max: single.value.mp.max } : null)

// 多部位:转换成 mini 组件需要的 { key, label, hp:{cur,max}, mp?:{cur,max} } 形态
const multiParts = computed(() => props.parts
  .filter(p => p.hp)
  .map(p => ({
    key: p.key,
    label: p.label || p.key,
    hp: { cur: p.hp!.value, max: p.hp!.max },
    mp: p.mp ? { cur: p.mp.value, max: p.mp.max } : null,
  })))
</script>

<template>
  <div :class="hitAny && 'fx-shake'">
    <CharacterParts
      v-if="isMulti"
      :parts="multiParts"
      :variant="displayMode"
    />
    <template v-else-if="singleHp">
      <MiniDiamondBar
        v-if="displayMode === 'C'"
        :hp="singleHp"
        :mp="singleMp"
      />
      <MiniInlinePill
        v-else
        :hp="singleHp"
        :mp="singleMp"
      />
    </template>
  </div>
</template>
