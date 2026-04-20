<script setup lang="ts">
// 浮层主壳:固定定位 + translate 控制拖动 + 折叠态只留标题栏 + 两个 Tab
import { computed, ref } from 'vue'
import BattleTab from '@/components/tabs/BattleTab.vue'
import CharactersTab from '@/components/tabs/CharactersTab.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useDraggable } from '@/composables/useDraggable'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

const settings = useSettingsStore()
const ui = useUiStore()

const containerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

useDraggable({
  handleRef,
  targetRef: containerRef,
  getPos: () => settings.panelPos,
  setPos: p => settings.setPanelPos(p),
})

const transform = computed(() => `translate(${settings.panelPos.x}px, ${settings.panelPos.y}px)`)
</script>

<template>
  <div
    ref="containerRef"
    class="fixed left-0 top-0 w-80 flex flex-col border border-white/10 rounded-md bg-surface text-white shadow-xl"
    :class="settings.panelCollapsed ? 'h-auto' : 'max-h-[32rem]'"
    :style="{ transform }"
  >
    <!-- 标题栏(拖动把手 + 折叠按钮) -->
    <div
      ref="handleRef"
      class="h-8 flex cursor-move items-center gap-2 border-b border-white/10 px-3 select-none"
    >
      <div class="i-lucide-sword text-4 text-hp" />
      <span class="text-sm font-medium">ccfolia-sword</span>
      <button
        type="button"
        class="ml-auto h-6 w-6 flex items-center justify-center rounded hover:bg-white/10"
        :title="settings.panelCollapsed ? '展开' : '折叠'"
        @click="settings.togglePanelCollapsed()"
      >
        <div :class="settings.panelCollapsed ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="text-4" />
      </button>
    </div>

    <div v-if="!settings.panelCollapsed" class="flex flex-1 flex-col min-h-0">
      <Tabs v-model="ui.activeTab">
        <TabsList class="h-8 flex border-b border-white/10 px-2">
          <TabsTrigger
            value="characters"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-accent"
          >角色库</TabsTrigger>
          <TabsTrigger
            value="battle"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-accent"
          >战斗</TabsTrigger>
        </TabsList>

        <TabsContent value="characters" class="flex-1 overflow-auto p-3">
          <CharactersTab />
        </TabsContent>
        <TabsContent value="battle" class="flex-1 overflow-auto p-3">
          <BattleTab />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
