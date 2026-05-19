<script setup lang="ts">
// 浮层主壳：固定定位 + translate 控制拖动 + 折叠态只留标题栏。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import logoUrl from '@/assets/logo.png'
import PanelLauncher from '@/components/shell/PanelLauncher.vue'
import BattleTab from '@/components/tabs/BattleTab.vue'
import BuffLibraryTab from '@/components/tabs/BuffLibraryTab.vue'
import ResolverTab from '@/components/tabs/ResolverTab.vue'
import RosterTab from '@/components/tabs/RosterTab.vue'
import SettingsTab from '@/components/tabs/SettingsTab.vue'
import TagLibraryTab from '@/components/tabs/TagLibraryTab.vue'
import TimerTab from '@/components/tabs/TimerTab.vue'
import { Logo, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useDraggable } from '@/composables/useDraggable'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useUndoHistoryStore } from '@/stores/undo-history'

const settings = useSettingsStore()
const ui = useUiStore()
const undoHistory = useUndoHistoryStore()

const canUndo = computed(() => undoHistory.undoStack.length > 0)
const undoTitle = computed(() => {
  if (!canUndo.value)
    return '撤销 (Ctrl+`) — 无可撤销操作'
  const top = undoHistory.undoStack[undoHistory.undoStack.length - 1]
  return `撤销 (Ctrl+\`) — ${top.label}`
})

function onUndoClick() {
  if (!canUndo.value)
    return
  void undoHistory.undo()
}

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
    class="fixed left-0 top-0 w-[34rem] flex flex-col overflow-hidden border border-white/10 rounded-md bg-surface text-white shadow-xl"
    :class="settings.panelCollapsed ? 'h-auto' : 'max-h-[32rem]'"
    :style="{ transform }"
  >
    <!-- 设置 tab 的背景图:固定在面板内,不会随 TabsContent 的滚动而移动 -->
    <div
      v-if="!settings.panelCollapsed && ui.activeTab === 'settings'"
      class="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat opacity-70"
      :style="{ backgroundImage: `url(${logoUrl})`, backgroundSize: 'min(95%, 400px)' }"
      aria-hidden="true"
    />
    <!-- 标题栏(拖动把手 + 折叠按钮) -->
    <div
      ref="handleRef"
      class="relative z-10 h-8 flex cursor-move select-none items-center gap-2 border-b border-white/10 bg-surface px-3"
    >
      <Logo :size="16" class="text-hp" />
      <span class="text-sm font-medium">ccfolia-sword</span>
      <button
        type="button"
        class="ml-auto h-6 w-6 flex items-center justify-center rounded disabled:cursor-not-allowed hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
        :title="undoTitle"
        :disabled="!canUndo"
        @click="onUndoClick"
      >
        <div class="i-lucide-undo-2 text-4" />
      </button>
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

    <div v-if="!settings.panelCollapsed" class="relative z-10 min-h-0 flex flex-1 flex-col">
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
            value="timer"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            计时
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Tag
          </TabsTrigger>
          <TabsTrigger
            value="buff-lib"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Buff 库
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" class="min-h-0 flex flex-1 flex-col p-3">
          <RosterTab />
        </TabsContent>
        <TabsContent value="battle" class="flex-1 overflow-auto p-3">
          <BattleTab />
        </TabsContent>
        <TabsContent value="timer" class="flex-1 overflow-auto p-3">
          <TimerTab />
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
