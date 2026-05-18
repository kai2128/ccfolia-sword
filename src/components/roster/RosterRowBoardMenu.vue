<script setup lang="ts">
// 「archive」按钮的多选 popover:替代单 PopConfirm。
// 触发器仍是熟悉的 i-lucide-archive 图标;点开后按当前状态(板内/板外)与是否有保存的板外位置列出可选动作。
//   - 板内:移动到板外(默认收纳位) / 送回板外 / 送回板外 + 回满 HP/MP
//   - 板外:放回画布中央 / 送回板外 / 送回板外 + 回满 HP/MP
// 没有保存过板外位置时,送回两项 disabled 且 hint「先点下方「保存板外位置」存一下」。
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, useTemplateRef } from 'vue'
import { usePortalTarget } from '@/components/ui'
import { useShadowPopoverTrigger } from '@/composables/useShadowPopoverTrigger'

defineProps<{
  offBoard: boolean
  hasParked: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleBoard'): void
  (e: 'sendToParked'): void
  (e: 'sendToParkedRestore'): void
  (e: 'saveParked'): void
}>()

const open = ref(false)
const target = usePortalTarget()
const triggerRef = useTemplateRef<{ $el: HTMLElement }>('trigger')
const { onPointerDownOutside } = useShadowPopoverTrigger(triggerRef)

function pick(action: 'toggle' | 'park' | 'parkRestore' | 'save') {
  open.value = false
  if (action === 'toggle')
    emit('toggleBoard')
  else if (action === 'park')
    emit('sendToParked')
  else if (action === 'parkRestore')
    emit('sendToParkedRestore')
  else
    emit('saveParked')
}

function cancel() {
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger ref="trigger" as-child>
      <button
        type="button"
        class="ml-1.5 h-5 w-5 flex shrink-0 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
        :title="offBoard ? '位置操作 · 当前在板外' : '位置操作 · 当前在板内'"
      >
        <span class="i-lucide-archive text-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        :side-offset="4"
        :collision-padding="8"
        align="end"
        class="z-30 flex flex-col border border-white/15 rounded bg-surface p-1 text-white shadow-lg focus:outline-none"
        @pointer-down-outside="onPointerDownOutside"
      >
        <button
          type="button"
          class="flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-left text-[11px] text-white/85 transition-colors hover:bg-white/10"
          @click="pick('toggle')"
        >
          <span class="i-lucide-archive shrink-0 text-3" />
          <span>{{ offBoard ? '放回画布中央' : '移动到板外' }}</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-left text-[11px] transition-colors disabled:cursor-not-allowed"
          :class="hasParked ? 'text-white/85 hover:bg-white/10' : 'text-white/30'"
          :disabled="!hasParked"
          :title="hasParked ? '送回保存的板外位置' : '先点下方「保存板外位置」存一下'"
          @click="pick('park')"
        >
          <span class="i-lucide-home shrink-0 text-3" />
          <span>送回板外</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-left text-[11px] transition-colors disabled:cursor-not-allowed"
          :class="hasParked ? 'text-emerald-300 hover:bg-emerald-400/15' : 'text-emerald-400/30'"
          :disabled="!hasParked"
          :title="hasParked ? '送回板外 + 全部部位 HP / MP 回满' : '先点下方「保存板外位置」存一下'"
          @click="pick('parkRestore')"
        >
          <span class="i-lucide-heart-pulse shrink-0 text-3" />
          <span>送回板外 + 回满 HP / MP</span>
        </button>

        <div class="my-0.5 h-px bg-white/10" />

        <button
          type="button"
          class="flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-left text-[11px] transition-colors disabled:cursor-not-allowed"
          :class="offBoard ? 'text-buff hover:bg-buff/15' : 'text-buff/30'"
          :disabled="!offBoard"
          :title="offBoard ? '把当前位置记下作为板外位置(可覆盖)' : '需先把角色挪到板外再点保存'"
          @click="pick('save')"
        >
          <span class="i-lucide-bookmark-plus shrink-0 text-3" />
          <span>{{ hasParked ? '更新板外位置' : '保存板外位置' }}</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-left text-[11px] text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
          @click="cancel"
        >
          <span class="i-lucide-x shrink-0 text-3" />
          <span>取消</span>
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
