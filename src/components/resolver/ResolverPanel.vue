<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui'
import { useResolverStore } from '@/stores/resolver'
import ActionForm from './ActionForm.vue'
import DiceInputs from './DiceInputs.vue'
import FlowBar from './FlowBar.vue'
import ResultSummary from './ResultSummary.vue'
import TargetList from './TargetList.vue'

const resolver = useResolverStore()
const resolution = computed(() => resolver.resolution)

const diceRef = ref<HTMLElement | null>(null)
const targetsRef = ref<HTMLElement | null>(null)
const damageRef = ref<HTMLElement | null>(null)

function scrollTo(anchor: 'dice' | 'targets' | 'damage') {
  const element = anchor === 'dice'
    ? diceRef.value
    : anchor === 'targets'
      ? targetsRef.value
      : damageRef.value

  element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
  <div v-if="resolver.draft && resolution" class="flex flex-col gap-2">
    <FlowBar :resolution="resolution" @scroll-to="scrollTo" />
    <ActionForm />
    <div ref="diceRef">
      <DiceInputs />
    </div>
    <div ref="targetsRef">
      <TargetList />
    </div>
    <div ref="damageRef">
      <ResultSummary />
    </div>

    <div class="flex justify-end gap-2">
      <Button size="sm" variant="ghost" @click="resolver.reset()">
        重开
      </Button>
      <Button size="sm" variant="ghost" @click="resolver.close()">
        关闭
      </Button>
    </div>
  </div>

  <div v-else class="flex items-center justify-center py-8">
    <Button size="sm" @click="resolver.open()">
      发起行动
    </Button>
  </div>
</template>
