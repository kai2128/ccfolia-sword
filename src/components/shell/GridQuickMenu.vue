<script setup lang="ts">
// tab 栏的网格按钮:左键切换显示网格,右键弹出网格快捷设置(显示标签 / 吸附拖动)。
// 用 PopoverAnchor(而非 PopoverTrigger)把左键留给可见性切换,菜单只由右键手动打开。
// 整个 app 在 shadow root 里,Popover 内容走 usePortalTarget 注入的 portal 目标。
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { ref } from 'vue'
import { Switch } from '@/components/ui'
import { usePortalTarget } from '@/components/ui/portal'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const target = usePortalTarget()
const open = ref(false)

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  open.value = true
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="open = $event">
    <PopoverAnchor as-child>
      <button
        type="button"
        class="my-1 ml-auto h-6 w-6 flex items-center self-center justify-center rounded hover:bg-white/10"
        :class="settings.gridOverlayVisible ? 'text-accent' : 'text-white/60'"
        title="显示网格(右键:更多设置)"
        @click="settings.setGridOverlayVisible(!settings.gridOverlayVisible)"
        @contextmenu="onContextMenu"
      >
        <div class="i-lucide-grid-3x3 text-4" />
      </button>
    </PopoverAnchor>
    <PopoverPortal :to="target ?? undefined">
      <PopoverContent
        align="end"
        :side-offset="6"
        :collision-padding="8"
        class="z-30 flex flex-col gap-2 border border-white/15 rounded bg-surface p-2 text-white shadow-lg focus:outline-none"
      >
        <label class="flex items-center gap-2 text-xs text-white/80">
          <Switch
            :model-value="settings.gridLabelsVisible"
            @update:model-value="settings.setGridLabelsVisible($event ?? false)"
          />
          显示标签
        </label>
        <label class="flex items-center gap-2 text-xs text-white/80">
          <Switch
            :model-value="settings.snapToGrid"
            @update:model-value="settings.setSnapToGrid($event ?? false)"
          />
          吸附拖动
        </label>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
