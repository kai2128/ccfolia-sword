<script setup lang="ts">
// 浮层主壳：固定定位 + translate 控制拖动 + 折叠态只留标题栏。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PanelLauncher from '@/components/shell/PanelLauncher.vue'
import BattleTab from '@/components/tabs/BattleTab.vue'
import BuffLibraryTab from '@/components/tabs/BuffLibraryTab.vue'
import ResolverTab from '@/components/tabs/ResolverTab.vue'
import RosterTab from '@/components/tabs/RosterTab.vue'
import SettingsTab from '@/components/tabs/SettingsTab.vue'
import TagLibraryTab from '@/components/tabs/TagLibraryTab.vue'
import { Logo, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useDraggable } from '@/composables/useDraggable'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

const settings = useSettingsStore()
const ui = useUiStore()

const containerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let syncFrame = 0

useDraggable({
  handleRef,
  targetRef: containerRef,
  getPos: () => settings.panelPos,
  setPos: (p, size) => settings.setPanelPos(p, size),
})

const transform = computed(() => `translate(${settings.panelPos.x}px, ${settings.panelPos.y}px)`)

function syncPanelBounds() {
  const container = containerRef.value
  if (!container)
    return
  const rect = container.getBoundingClientRect()
  settings.ensurePanelVisible({ width: rect.width, height: rect.height })
}

function schedulePanelBoundsSync() {
  if (syncFrame)
    cancelAnimationFrame(syncFrame)
  syncFrame = requestAnimationFrame(() => {
    syncFrame = 0
    syncPanelBounds()
  })
}

onMounted(() => {
  schedulePanelBoundsSync()
  const container = containerRef.value
  if (container && 'ResizeObserver' in window) {
    // 面板高度会随折叠态变化,观察真实尺寸后再把坐标夹回可见区域。
    resizeObserver = new ResizeObserver(() => schedulePanelBoundsSync())
    resizeObserver.observe(container)
  }
  window.addEventListener('resize', schedulePanelBoundsSync)
})

onBeforeUnmount(() => {
  if (syncFrame)
    cancelAnimationFrame(syncFrame)
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', schedulePanelBoundsSync)
})
</script>

<template>
  <PanelLauncher v-if="!settings.panelVisible" />
  <div
    v-show="settings.panelVisible"
    ref="containerRef"
    class="fixed left-0 top-0 w-96 flex flex-col border border-white/10 rounded-md bg-surface text-white shadow-xl"
    :class="settings.panelCollapsed ? 'h-auto' : 'max-h-[32rem]'"
    :style="{ transform }"
  >
    <!-- 标题栏(拖动把手 + 折叠按钮) -->
    <div
      ref="handleRef"
      class="h-8 flex cursor-move select-none items-center gap-2 border-b border-white/10 px-3"
    >
      <Logo :size="16" class="text-hp" />
      <span class="text-sm font-medium">ccfolia-sword</span>
      <span class="ml-auto text-xs text-white/40 italic">- by rara</span>
      <button
        type="button"
        class="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10"
        title="收起到 launcher (Alt+S)"
        @click="settings.hidePanel()"
      >
        <div class="i-lucide-x text-4" />
      </button>
      <button
        type="button"
        class="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10"
        :title="settings.panelCollapsed ? '展开' : '折叠'"
        @click="settings.togglePanelCollapsed()"
      >
        <div :class="settings.panelCollapsed ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="text-4" />
      </button>
    </div>

    <div v-if="!settings.panelCollapsed" class="min-h-0 flex flex-1 flex-col">
      <Tabs v-model="ui.activeTab">
        <TabsList class="h-8 flex border-b border-white/10 px-2">
          <TabsTrigger
            value="roster"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            角色
          </TabsTrigger>
          <TabsTrigger
            value="battle"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            战斗
          </TabsTrigger>
          <TabsTrigger
            value="buff-lib"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Buff 库
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Tag
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" class="flex-1 overflow-auto p-3">
          <RosterTab />
        </TabsContent>
        <TabsContent value="battle" class="flex-1 overflow-auto p-3">
          <BattleTab />
        </TabsContent>
        <TabsContent value="buff-lib" class="flex-1 overflow-auto p-3">
          <BuffLibraryTab />
        </TabsContent>
        <TabsContent value="resolver" class="flex-1 overflow-auto p-3">
          <ResolverTab />
        </TabsContent>
        <TabsContent value="tags" class="flex-1 overflow-auto p-3">
          <TagLibraryTab />
        </TabsContent>
        <TabsContent value="settings" class="flex-1 overflow-auto p-3">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
