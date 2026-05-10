<script setup lang="ts">
// Roster row 上的 "状态调整" 下拉:music 图标按钮,展开后列出该角色身上
// 命中 高昂 / 镇静 / 魅惑 前缀的 status 条目(支持后缀,如 "高昂+1"),
// 每条带 +/- 直接增减自身 value。**不会**新建条目 —— 只 modify 现有 label。
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { adjustStatusByLabel } from '@/ccfolia/writers/adjust-status-by-label'
import { usePortalTarget } from '@/components/ui'
import { extractStatusChips } from '@/core/overlay/status-chip'

const props = defineProps<{
  char: CcfoliaCharacter
}>()

const open = ref(false)
const target = usePortalTarget()

// rows 直接来自 extractStatusChips:label 用角色身上的原 label(可能带后缀),
// +/- 走相同 label,所以不会插出 "高昂" / "高昂+1" 两条。
const rows = computed(() => extractStatusChips(props.char.status))

async function bump(label: string, delta: number) {
  try {
    await adjustStatusByLabel({ char: props.char, label, delta })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`调整 ${label} 失败:${(e as Error).message}`)
  }
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center rounded text-white hover:bg-white/10"
        title="增减状态(高昂 / 镇静 / 魅惑)"
      >
        <span class="i-lucide-music text-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        align="end"
        :side-offset="6"
        :collision-padding="8"
        class="z-30 min-w-44 flex flex-col gap-1 border border-white/15 rounded bg-surface p-1.5 text-white shadow-lg focus:outline-none"
      >
        <div
          v-for="r in rows"
          :key="r.label"
          class="flex items-center gap-2 rounded px-1.5 py-1"
        >
          <span
            class="h-4 w-4 inline-flex shrink-0 items-center justify-center rounded-sm text-[10px] font-bold leading-none font-serif"
            :style="{ background: r.record.hue, color: '#0b1224', textShadow: '0 1px 0 rgba(255,255,255,.4)' }"
          >{{ r.record.glyph }}</span>
          <span class="min-w-0 flex-1 truncate text-xs">{{ r.label }}</span>
          <button
            type="button"
            class="h-5 w-5 flex shrink-0 items-center justify-center border border-white/15 rounded text-white/80 hover:bg-white/10 hover:text-white"
            :title="`${r.label} -1`"
            :disabled="r.value <= 0"
            :class="{ 'opacity-30 cursor-not-allowed': r.value <= 0 }"
            @click="bump(r.label, -1)"
          >
            <span class="i-lucide-minus text-3" />
          </button>
          <span
            class="w-5 text-center text-xs font-mono"
            :class="r.value > 0 ? 'text-white' : 'text-white/30'"
          >{{ r.value }}</span>
          <button
            type="button"
            class="h-5 w-5 flex shrink-0 items-center justify-center border border-white/15 rounded text-white/80 hover:bg-white/10 hover:text-white"
            :title="`${r.label} +1`"
            @click="bump(r.label, 1)"
          >
            <span class="i-lucide-plus text-3" />
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
