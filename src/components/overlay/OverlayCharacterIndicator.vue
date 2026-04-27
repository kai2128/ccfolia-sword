<script setup lang="ts">
// 单个角色 (棋子上方) 的 HP/MP 指示器装配器:
//   • parts.length <= 1 → 两条 CapsuleBar (HP + 可选 MP)
//   • parts.length > 1  → HPMultiPart,每个 part 自带可选 MP
// 受击 shake:本组件统一维护 partKey → 是否抖动 的 map,watch 到某 part HP 下降即打 280ms。
// 这层包装的好处:hit 状态按角色 instance 持久,避免 SceneOverlayLayer 全表 watch 误伤。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CapsuleBar from './CapsuleBar.vue'
import HPMultiPart from './HPMultiPart.vue'

interface PartInput {
  key: string
  label: string
  isMain: boolean
  hp: { value: number, max: number } | null
  mp: { value: number, max: number } | null
}

const props = defineProps<{
  parts: PartInput[]
  widthPx: number
}>()

const hitMap = ref<Record<string, boolean>>({})
const timers = new Map<string, ReturnType<typeof setTimeout>>()

watch(
  () => props.parts.map(p => ({ key: p.key, cur: p.hp?.value ?? 0 })),
  (next, prev) => {
    if (!prev)
      return
    const prevByKey = new Map(prev.map(p => [p.key, p.cur]))
    for (const { key, cur } of next) {
      const before = prevByKey.get(key)
      if (before == null || cur >= before)
        continue
      const existing = timers.get(key)
      if (existing)
        clearTimeout(existing)
      // 先 false 再 true 以重启 CSS 动画
      hitMap.value = { ...hitMap.value, [key]: false }
      void Promise.resolve().then(() => {
        hitMap.value = { ...hitMap.value, [key]: true }
        timers.set(key, setTimeout(() => {
          hitMap.value = { ...hitMap.value, [key]: false }
        }, 280))
      })
    }
  },
  { deep: true },
)

onBeforeUnmount(() => {
  for (const t of timers.values())
    clearTimeout(t)
  timers.clear()
})

const isMulti = computed(() => props.parts.length > 1)

// 单部位:第一条 part 即主 part
const single = computed(() => props.parts[0] ?? null)
const singleHit = computed(() => hitMap.value[single.value?.key ?? ''] ?? false)
const singleWidth = computed(() => Math.max(90, Math.min(150, Math.round(props.widthPx))))
// 多部位左侧多 24px label 列,需要比单部位略宽,但不过分膨胀。
const multiWidth = computed(() => Math.max(130, Math.min(180, Math.round(props.widthPx) + 30)))

// 多部位:把每个 part 的 hp/mp 都透传,让 HPMultiPart 渲染 HP+MP 紧贴对
const multiParts = computed(() => props.parts
  .filter(p => p.hp)
  .map(p => ({
    label: p.label || p.key,
    cur: p.hp!.value,
    max: p.hp!.max,
    mp: p.mp ? { cur: p.mp.value, max: p.mp.max } : null,
    main: p.isMain,
    hit: hitMap.value[p.key] ?? false,
  })))
</script>

<template>
  <HPMultiPart
    v-if="isMulti"
    :parts="multiParts"
    :width="multiWidth"
  />
  <div v-else-if="single?.hp" class="flex flex-col items-stretch">
    <CapsuleBar
      kind="hp"
      :cur="single.hp.value"
      :max="single.hp.max"
      :width="singleWidth"
      :height="12"
      :hit="singleHit"
      :value-font-px="10"
      label=""
    />
    <CapsuleBar
      v-if="single.mp"
      kind="mp"
      :cur="single.mp.value"
      :max="single.mp.max"
      :width="singleWidth"
      :height="6"
      value-anchor="bottom"
      :value-font-px="7"
      label=""
      :style="{ marginTop: '-3px' }"
    />
  </div>
</template>
