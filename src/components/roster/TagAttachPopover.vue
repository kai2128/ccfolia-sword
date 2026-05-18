<script setup lang="ts">
import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { attachTag, detachTag } from '@/ccfolia/writers/write-tags'
import { TagChip, usePortalTarget } from '@/components/ui'
import { useShadowPopoverTrigger } from '@/composables/useShadowPopoverTrigger'
import { readTagInstances } from '@/core/tag'
import { useTagLibraryStore } from '@/stores/tag-library'

const props = defineProps<{
  char: CcfoliaCharacter
  // 主 tag(order 最小那条)。决定触发按钮的底色和图标 tint;没挂 tag 时传 null。
  primary?: TagDefinition | null
}>()

const lib = useTagLibraryStore()
const open = ref(false)
// 防止 await 未完成时连续点击同一 tag 造成 race / toggle 不一致
const busy = ref(false)
// Shadow DOM 下 Reka Portal 必须显式传目标节点,否则样式跑出 Shadow 边界丢 UnoCSS
const target = usePortalTarget()
const triggerRef = useTemplateRef<{ $el: HTMLElement }>('trigger')
const { onPointerDownOutside } = useShadowPopoverTrigger(triggerRef)

const attachedIds = computed(() =>
  new Set(readTagInstances(props.char).map(tag => tag.definitionId)),
)

const triggerStyle = computed(() => {
  if (props.primary) {
    return {
      backgroundColor: props.primary.color,
      borderColor: props.primary.color,
      color: '#fff',
    }
  }
  return null
})

async function toggle(tagId: string) {
  if (busy.value)
    return
  busy.value = true
  try {
    if (attachedIds.value.has(tagId))
      await detachTag(props.char, tagId)
    else
      await attachTag(props.char, tagId)
  }
  catch (error) {
    // eslint-disable-next-line no-alert
    alert(`操作失败:${(error as Error).message}`)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger ref="trigger" as-child>
      <button
        type="button"
        class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-full transition-colors"
        :class="primary
          ? 'border-transparent hover:brightness-110'
          : 'border-white/20 bg-black/30 text-white/60 hover:bg-white/10 hover:text-white'"
        :style="triggerStyle"
        :title="primary ? `Tag · ${primary.label}` : '挂/卸 tag'"
      >
        <span
          :class="[primary?.icon || 'i-lucide-tag']"
          class="text-3"
        />
      </button>
    </PopoverTrigger>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        align="end"
        :side-offset="6"
        :collision-padding="8"
        class="z-30 min-w-44 flex flex-col gap-0.5 border border-white/15 rounded bg-surface p-1.5 text-white shadow-lg focus:outline-none"
        @pointer-down-outside="onPointerDownOutside"
      >
        <button
          v-for="tag in lib.all"
          :key="tag.id"
          type="button"
          :disabled="busy"
          class="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left transition-colors disabled:cursor-wait disabled:opacity-60"
          :class="attachedIds.has(tag.id) ? 'bg-white/10' : 'hover:bg-white/5'"
          @click.stop="toggle(tag.id)"
        >
          <TagChip :tag="tag" size="xs" />
          <span
            v-if="attachedIds.has(tag.id)"
            class="i-lucide-check text-3 text-accent"
          />
        </button>
        <p v-if="lib.all.length === 0" class="px-1.5 py-1 text-center text-[11px] text-white/40">
          Tag 库为空
        </p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
